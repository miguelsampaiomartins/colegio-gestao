import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { parse as parseCookies } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { staffAccounts, staffRoles, users, type User } from "../drizzle/schema";
import { allStaffPermissions, permissionKeys, type PermissionKey } from "../shared/permissions";
import { getDb } from "./db";
import { googleSessionCookieOptions } from "./googleAuth";

export const LOCAL_COOKIE_NAME = "school_local_session";
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLEL = 3;
const SCRYPT_OPTIONS = { N: COST, r: BLOCK_SIZE, p: PARALLEL, maxmem: 64 * 1024 * 1024 };
function derivePassword(value: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(value, salt, 64, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const ISSUER = "colegio-gestao-local";
const AUDIENCE = "colegio-gestao";
const invalidLogin = () => new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos. Tente novamente mais tarde se necessário." });

export type LocalRole = "owner" | "staff";
export type LocalUser = User & { localRole: LocalRole; localPermissions: PermissionKey[] };
export function localModeEnabled() { return process.env.VITE_AUTH_PROVIDER === "password"; }
export function localAuthStatus() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) missing.push("JWT_SECRET (mínimo 32 caracteres)");
  return { mode: "password" as const, configured: missing.length === 0, missing };
}

export function makeUsername(firstName: string, cpfFirstFour: string) {
  const first = firstName.trim().split(/\s+/)[0]?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "") ?? "";
  if (first.length < 2 || first.length > 30 || !/^\d{4}$/.test(cpfFirstFour)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe primeiro nome e exatamente os quatro primeiros dígitos do CPF." });
  }
  return `${first}${cpfFirstFour}`;
}

export function validateNewPassword(value: string) {
  if (value.length < 8 || value.length > 128 || Buffer.byteLength(value) > 256) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A senha deve ter entre 8 e 128 caracteres (máximo de 256 bytes)." });
  }
  return value;
}

export async function hashPassword(value: string) {
  validateNewPassword(value);
  const salt = randomBytes(16);
  const hash = await derivePassword(value, salt);
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLEL}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(value: string, encoded: string) {
  const [kind, n, r, p, saltHex, hashHex] = encoded.split("$");
  if (kind !== "scrypt" || +n !== COST || +r !== BLOCK_SIZE || +p !== PARALLEL ||
    !/^[0-9a-f]{32}$/.test(saltHex ?? "") || !/^[0-9a-f]{128}$/.test(hashHex ?? "") || Buffer.byteLength(value) > 256) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derivePassword(value, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;
function getDummyHash() { return (dummyHash ??= hashPassword("placeholder-for-missing-user-only")); }
function requireDatabase(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

// The in-memory limiter complements the durable per-account lock; for distributed hosting use a shared rate limiter.
const attemptsByIp = new Map<string, { count: number; expiresAt: number }>();
function throttle(ip: string) {
  const now = Date.now();
  if (attemptsByIp.size > 2000) attemptsByIp.forEach((value, key) => { if (value.expiresAt < now) attemptsByIp.delete(key); });
  const value = attemptsByIp.get(ip);
  if (value && value.expiresAt > now && value.count >= 30) throw invalidLogin();
  attemptsByIp.set(ip, { count: (value && value.expiresAt > now ? value.count : 0) + 1, expiresAt: now + 10 * 60_000 });
}

export async function loginWithPassword(username: string, password: string, ip: string) {
  if (!localModeEnabled() || !localAuthStatus().configured) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure o modo de login local." });
  throttle(ip);
  const db = requireDatabase(await getDb());
  const normalized = username.trim().toLowerCase();
  const [account] = await db.select().from(staffAccounts).where(eq(staffAccounts.username, normalized)).limit(1);
  const valid = await verifyPassword(password, account?.passwordHash ?? await getDummyHash());
  const now = Date.now();
  if (!account || !account.active || (account.lockedUntil && account.lockedUntil > now) || !valid) {
    if (account?.active && (!account.lockedUntil || account.lockedUntil <= now)) {
      const attempts = account.lockedUntil ? 1 : account.failedAttempts + 1;
      await db.update(staffAccounts).set({ failedAttempts: attempts, lockedUntil: attempts >= 5 ? now + 15 * 60_000 : null }).where(eq(staffAccounts.id, account.id));
    }
    throw invalidLogin();
  }
  await db.update(staffAccounts).set({ failedAttempts: 0, lockedUntil: null }).where(eq(staffAccounts.id, account.id));
  const [user] = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);
  if (!user) throw invalidLogin();
  return { account, user };
}

export function localCookieOptions(req: Request) { return googleSessionCookieOptions(req); }
export async function makeLocalSession(account: { id: number; sessionVersion: number }) {
  if (!localAuthStatus().configured) throw new Error("JWT_SECRET is not configured");
  return new SignJWT({ version: account.sessionVersion })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(account.id))
    .setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().setExpirationTime("8h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
}
export const localSessionMaxAge = SESSION_LIFETIME_MS;

export async function authenticateLocalRequest(req: Request): Promise<LocalUser | null> {
  if (!localModeEnabled() || !localAuthStatus().configured) return null;
  const token = parseCookies(req.headers.cookie ?? "")[LOCAL_COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!), {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE,
    });
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof payload.version !== "number") return null;
    const db = requireDatabase(await getDb());
    const [row] = await db.select({ account: staffAccounts, user: users, role: staffRoles }).from(staffAccounts)
      .innerJoin(users, eq(staffAccounts.userId, users.id)).leftJoin(staffRoles, eq(staffAccounts.roleId, staffRoles.id)).where(eq(staffAccounts.id, id)).limit(1);
    if (!row || !row.account.active || row.account.sessionVersion !== payload.version || row.user.loginMethod !== "password") return null;
    let localPermissions: PermissionKey[] = [];
    if (row.account.role === "owner") localPermissions = allStaffPermissions;
    else if (!row.account.roleId) localPermissions = allStaffPermissions;
    else {
      try {
        const parsed: unknown = JSON.parse(row.role?.permissions ?? "[]");
        localPermissions = Array.isArray(parsed) ? parsed.filter((permission): permission is PermissionKey => typeof permission === "string" && permissionKeys.includes(permission as PermissionKey)) : [];
      } catch { localPermissions = []; }
    }
    return { ...row.user, localRole: row.account.role, localPermissions };
  } catch { return null; }
}

export async function createFirstOwner(input: { firstName: string; cpfFirstFour: string; fullName: string; password: string }) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
  const username = makeUsername(input.firstName, input.cpfFirstFour);
  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > 160) throw new Error("Nome completo inválido.");
  const passwordHash = await hashPassword(input.password);
  const db = requireDatabase(await getDb());
  return db.transaction(async tx => {
    const [already] = await tx.select({ id: staffAccounts.id }).from(staffAccounts).where(eq(staffAccounts.ownerSlot, 1)).limit(1);
    if (already) throw new Error("O dono já foi cadastrado. Não é possível inicializar outro.");
    const [inserted] = await tx.insert(users).values({ openId: `local:${randomUUID()}`, name: fullName, loginMethod: "password", role: "admin" });
    await tx.insert(staffAccounts).values({ userId: inserted.insertId, username, fullName, jobTitle: "Dono do colégio", role: "owner", ownerSlot: 1, passwordHash });
    return username;
  });
}

/** Local recovery path: updates only the existing owner account and revokes its sessions. */
export async function resetOwnerPassword(input: { username: string; newPassword: string }) {
  const db = requireDatabase(await getDb());
  const username = input.username.trim().toLowerCase();
  const [owner] = await db.select({ id: staffAccounts.id, username: staffAccounts.username, fullName: staffAccounts.fullName, role: staffAccounts.role })
    .from(staffAccounts).where(and(eq(staffAccounts.username, username), eq(staffAccounts.role, "owner"))).limit(1);
  if (!owner) throw new Error("Conta de dono não encontrada. Confira o nome de usuário e tente novamente.");
  const passwordHash = await hashPassword(input.newPassword);
  await db.update(staffAccounts).set({ passwordHash, sessionVersion: sql`${staffAccounts.sessionVersion} + 1`, failedAttempts: 0, lockedUntil: null })
    .where(and(eq(staffAccounts.id, owner.id), eq(staffAccounts.role, "owner")));
  return { username: owner.username, fullName: owner.fullName };
}

export async function listStaffRoles() {
  const db = requireDatabase(await getDb());
  return db.select().from(staffRoles).orderBy(staffRoles.name);
}

export function normalizeRolePermissions(values: string[]) {
  return Array.from(new Set(values)).filter(value => permissionKeys.includes(value as PermissionKey));
}

export async function createStaffRole(input: { name: string; permissions: string[] }) {
  const db = requireDatabase(await getDb());
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um nome de função entre 2 e 80 caracteres." });
  try {
    const [created] = await db.insert(staffRoles).values({ name, permissions: JSON.stringify(normalizeRolePermissions(input.permissions)) });
    return (await db.select().from(staffRoles).where(eq(staffRoles.id, created.insertId)).limit(1))[0];
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Esta função já existe." });
    throw error;
  }
}

export async function updateStaffRole(input: { id: number; name: string; permissions: string[] }) {
  const db = requireDatabase(await getDb());
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um nome de função entre 2 e 80 caracteres." });
  await db.update(staffRoles).set({ name, permissions: JSON.stringify(normalizeRolePermissions(input.permissions)), updatedAt: new Date() }).where(eq(staffRoles.id, input.id));
  return (await db.select().from(staffRoles).where(eq(staffRoles.id, input.id)).limit(1))[0];
}

export async function listStaff() {
  const db = requireDatabase(await getDb());
  return db.select({ id: staffAccounts.id, username: staffAccounts.username, fullName: staffAccounts.fullName,
    jobTitle: staffAccounts.jobTitle, active: staffAccounts.active, role: staffAccounts.role, roleId: staffAccounts.roleId,
    roleName: staffRoles.name, createdAt: staffAccounts.createdAt })
    .from(staffAccounts).leftJoin(staffRoles, eq(staffAccounts.roleId, staffRoles.id)).orderBy(staffAccounts.fullName);
}

export async function addStaff(input: { firstName: string; cpfFirstFour: string; fullName: string; roleId: number; password: string }) {
  const username = makeUsername(input.firstName, input.cpfFirstFour);
  const fullName = input.fullName.trim();
  const db = requireDatabase(await getDb());
  const [selectedRole] = await db.select().from(staffRoles).where(eq(staffRoles.id, input.roleId)).limit(1);
  if (fullName.length < 2 || fullName.length > 160 || !selectedRole) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe nome completo e uma função válida." });
  const passwordHash = await hashPassword(input.password);
  try {
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(users).values({ openId: `local:${randomUUID()}`, name: fullName, role: "user", loginMethod: "password" });
      await tx.insert(staffAccounts).values({ userId: inserted.insertId, username, fullName, jobTitle: selectedRole.name, role: "staff", roleId: selectedRole.id, passwordHash });
    });
  } catch (error) {
    if (typeof error === "object" && error && ("code" in error && error.code === "ER_DUP_ENTRY" || "cause" in error && (error.cause as { code?: string })?.code === "ER_DUP_ENTRY")) {
      throw new TRPCError({ code: "CONFLICT", message: "Este nome de usuário já está cadastrado." });
    }
    throw error;
  }
  return username;
}

export async function setStaffActive(id: number, active: boolean) {
  const db = requireDatabase(await getDb());
  const [target] = await db.select({ id: staffAccounts.id, role: staffAccounts.role }).from(staffAccounts).where(eq(staffAccounts.id, id)).limit(1);
  if (!target || target.role !== "staff") throw new TRPCError({ code: "BAD_REQUEST", message: "Somente o acesso de funcionários pode ser alterado." });
  await db.update(staffAccounts).set({ active: active ? 1 : 0, sessionVersion: sql`${staffAccounts.sessionVersion} + 1`, failedAttempts: 0, lockedUntil: null })
    .where(and(eq(staffAccounts.id, id), eq(staffAccounts.role, "staff")));
  return true;
}

/** Permanently removes a staff login and its linked identity; audit rows remain append-only. */
export async function deleteStaffAccount(id: number) {
  const db = requireDatabase(await getDb());
  const [target] = await db.select({ id: staffAccounts.id, userId: staffAccounts.userId, role: staffAccounts.role })
    .from(staffAccounts).where(eq(staffAccounts.id, id)).limit(1);
  if (!target || target.role !== "staff") throw new TRPCError({ code: "BAD_REQUEST", message: "Somente contas de funcionários podem ser excluídas." });
  await db.transaction(async tx => {
    await tx.delete(staffAccounts).where(and(eq(staffAccounts.id, id), eq(staffAccounts.role, "staff")));
    await tx.delete(users).where(eq(users.id, target.userId));
  });
  return true;
}

async function verifyCurrentPassword(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, account: { id: number; passwordHash: string; failedAttempts: number; lockedUntil: number | null }, candidate: string) {
  const now = Date.now();
  const matches = await verifyPassword(candidate, account.passwordHash);
  if ((account.lockedUntil && account.lockedUntil > now) || !matches) {
    if (!account.lockedUntil || account.lockedUntil <= now) {
      const attempts = account.lockedUntil ? 1 : account.failedAttempts + 1;
      await db.update(staffAccounts).set({ failedAttempts: attempts, lockedUntil: attempts >= 5 ? now + 15 * 60_000 : null }).where(eq(staffAccounts.id, account.id));
    }
    throw new TRPCError({ code: "FORBIDDEN", message: "Senha atual incorreta ou temporariamente bloqueada." });
  }
  await db.update(staffAccounts).set({ failedAttempts: 0, lockedUntil: null }).where(eq(staffAccounts.id, account.id));
}

export async function resetStaffPassword(input: { ownerUserId: number; targetId: number; ownerPassword: string; newPassword: string }) {
  const db = requireDatabase(await getDb());
  const [owner] = await db.select().from(staffAccounts).where(and(eq(staffAccounts.userId, input.ownerUserId), eq(staffAccounts.role, "owner"))).limit(1);
  if (!owner?.active) throw new TRPCError({ code: "FORBIDDEN" });
  await verifyCurrentPassword(db, owner, input.ownerPassword);
  const [target] = await db.select({ id: staffAccounts.id, role: staffAccounts.role }).from(staffAccounts).where(eq(staffAccounts.id, input.targetId)).limit(1);
  if (!target || target.role !== "staff") throw new TRPCError({ code: "BAD_REQUEST", message: "Funcionário não encontrado." });
  const passwordHash = await hashPassword(input.newPassword);
  await db.update(staffAccounts).set({ passwordHash, sessionVersion: sql`${staffAccounts.sessionVersion} + 1`, failedAttempts: 0, lockedUntil: null })
    .where(and(eq(staffAccounts.id, input.targetId), eq(staffAccounts.role, "staff")));
  return true;
}

export async function changeOwnPassword(userId: number, currentPassword: string, newPassword: string) {
  const db = requireDatabase(await getDb());
  const [account] = await db.select().from(staffAccounts).where(eq(staffAccounts.userId, userId)).limit(1);
  if (!account?.active) throw new TRPCError({ code: "FORBIDDEN" });
  await verifyCurrentPassword(db, account, currentPassword);
  const passwordHash = await hashPassword(newPassword);
  await db.update(staffAccounts).set({ passwordHash, sessionVersion: sql`${staffAccounts.sessionVersion} + 1`, failedAttempts: 0, lockedUntil: null }).where(eq(staffAccounts.id, account.id));
  return true;
}
