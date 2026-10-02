import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { parse as parseCookies } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { enrollments, guardianAccounts, guardianMessages, guardianNotifications, guardianStudents, students } from "../drizzle/schema";
import { getDb } from "./db";
import { hashPassword, verifyPassword, localAuthStatus, localCookieOptions } from "./localAccounts";
import { normalizeBrazilianPhone } from "./studentValidation";

export const GUARDIAN_COOKIE_NAME = "school_guardian_session";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const ISSUER = "colegio-gestao-guardian";
const AUDIENCE = "colegio-gestao-family";
const attemptsByIp = new Map<string, { count: number; expiresAt: number }>();
const invalidLogin = () => new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });

function requireDatabase(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}
function throttle(ip: string) {
  const now = Date.now();
  const current = attemptsByIp.get(ip);
  if (attemptsByIp.size > 2000) attemptsByIp.forEach((value, key) => { if (value.expiresAt < now) attemptsByIp.delete(key); });
  if (current && current.expiresAt > now && current.count >= 30) throw invalidLogin();
  attemptsByIp.set(ip, { count: current && current.expiresAt > now ? current.count + 1 : 1, expiresAt: now + 10 * 60_000 });
}

export type GuardianSession = { guardianId: number; email: string; fullName: string; studentIds: number[] };

export async function loginGuardian(email: string, password: string, ip: string) {
  if (!localAuthStatus().configured) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O banco e a chave de sessão ainda não estão configurados." });
  throttle(ip);
  const db = requireDatabase(await getDb());
  const normalized = email.trim().toLowerCase();
  const [account] = await db.select().from(guardianAccounts).where(eq(guardianAccounts.email, normalized)).limit(1);
  const valid = await verifyPassword(password, account?.passwordHash ?? await hashPassword("placeholder-family-login"));
  if (!account || !account.active || !valid) throw invalidLogin();
  const links = await db.select({ studentId: guardianStudents.studentId }).from(guardianStudents).where(eq(guardianStudents.guardianId, account.id));
  return { account, studentIds: links.map(link => link.studentId) };
}

export async function makeGuardianSession(account: { id: number; sessionVersion: number }) {
  if (!localAuthStatus().configured) throw new Error("JWT_SECRET is not configured");
  return new SignJWT({ version: account.sessionVersion, kind: "guardian" })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(account.id)).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime("8h").sign(new TextEncoder().encode(process.env.JWT_SECRET!));
}
export const guardianSessionMaxAge = SESSION_LIFETIME_MS;

export function normalizeMessageSenderName(senderName?: string | null) {
  const normalized = senderName?.trim().slice(0, 160);
  return normalized || "Secretaria";
}

export function normalizeGuardianPhone(phone?: string | null) {
  return phone?.trim() ? normalizeBrazilianPhone(phone) : null;
}

export async function authenticateGuardianRequest(req: Request): Promise<GuardianSession | null> {
  if (!localAuthStatus().configured) return null;
  const token = parseCookies(req.headers.cookie ?? "")[GUARDIAN_COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof payload.version !== "number") return null;
    const db = requireDatabase(await getDb());
    const [account] = await db.select().from(guardianAccounts).where(and(eq(guardianAccounts.id, id), eq(guardianAccounts.active, 1), eq(guardianAccounts.sessionVersion, payload.version))).limit(1);
    if (!account) return null;
    const links = await db.select({ studentId: guardianStudents.studentId }).from(guardianStudents).where(eq(guardianStudents.guardianId, account.id));
    return { guardianId: account.id, email: account.email, fullName: account.fullName, studentIds: links.map(link => link.studentId) };
  } catch { return null; }
}

export function guardianCookieOptions(req: Request) { return localCookieOptions(req); }

export async function createGuardianAccount(input: { studentId: number; email: string; fullName: string; phone?: string; password: string }) {
  const db = requireDatabase(await getDb());
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = normalizeGuardianPhone(input.phone);
  const [student] = await db.select({ id: students.id, name: students.name, guardianEmail: students.guardianEmail, guardianName: students.guardianName }).from(students).where(and(eq(students.id, input.studentId), eq(students.status, "active"))).limit(1);
  if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno ativo não encontrado." });
  if (student.guardianEmail && student.guardianEmail.toLowerCase() !== email) throw new TRPCError({ code: "BAD_REQUEST", message: "O e-mail deve ser o mesmo cadastrado para o responsável deste aluno." });
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async tx => {
      const [existing] = await tx.select().from(guardianAccounts).where(eq(guardianAccounts.email, email)).limit(1);
      let guardianId: number;
      if (existing) {
        guardianId = existing.id;
        await tx.update(guardianAccounts).set({ fullName, phone, passwordHash, active: 1, sessionVersion: existing.sessionVersion + 1, updatedAt: new Date() }).where(eq(guardianAccounts.id, existing.id));
      } else {
        const [created] = await tx.insert(guardianAccounts).values({ email, fullName, phone, passwordHash });
        guardianId = created.insertId;
      }
      const [link] = await tx.select({ id: guardianStudents.id }).from(guardianStudents).where(and(eq(guardianStudents.guardianId, guardianId), eq(guardianStudents.studentId, input.studentId))).limit(1);
      if (!link) await tx.insert(guardianStudents).values({ guardianId, studentId: input.studentId });
      return { guardianId, email, fullName, studentName: student.name };
    });
  } catch (error) {
    const dbError = error as { code?: string; cause?: { code?: string } };
    if (dbError.code === "ER_DUP_ENTRY" || dbError.cause?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta familiar com este e-mail." });
    throw error;
  }
}

export async function resetGuardianPassword(input: { guardianId: number; newPassword: string }) {
  const db = requireDatabase(await getDb());
  const passwordHash = await hashPassword(input.newPassword);
  const [account] = await db.select({ id: guardianAccounts.id, email: guardianAccounts.email, fullName: guardianAccounts.fullName, sessionVersion: guardianAccounts.sessionVersion }).from(guardianAccounts).where(eq(guardianAccounts.id, input.guardianId)).limit(1);
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Conta familiar não encontrada." });
  await db.update(guardianAccounts).set({ passwordHash, sessionVersion: account.sessionVersion + 1, active: 1, updatedAt: new Date() }).where(eq(guardianAccounts.id, input.guardianId));
  return { email: account.email, fullName: account.fullName };
}

export async function updateGuardianAccount(input: { guardianId: number; email: string; fullName: string; phone?: string; newPassword?: string }) {
  const db = requireDatabase(await getDb());
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = normalizeGuardianPhone(input.phone);
  const [account] = await db.select({ id: guardianAccounts.id, sessionVersion: guardianAccounts.sessionVersion }).from(guardianAccounts).where(eq(guardianAccounts.id, input.guardianId)).limit(1);
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Conta familiar não encontrada." });
  const passwordHash = input.newPassword?.trim() ? await hashPassword(input.newPassword) : undefined;
  try {
    await db.update(guardianAccounts).set({ email, fullName, phone, ...(passwordHash ? { passwordHash, sessionVersion: account.sessionVersion + 1 } : {}), updatedAt: new Date() }).where(eq(guardianAccounts.id, input.guardianId));
  } catch (error) {
    const dbError = error as { code?: string; cause?: { code?: string } };
    if (dbError.code === "ER_DUP_ENTRY" || dbError.cause?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta familiar com este e-mail." });
    throw error;
  }
  return { email, fullName, phone: phone ?? "" };
}

export async function listGuardianAccounts() {
  const db = requireDatabase(await getDb());
  return db.select({ id: guardianAccounts.id, email: guardianAccounts.email, fullName: guardianAccounts.fullName, phone: guardianAccounts.phone, active: guardianAccounts.active, createdAt: guardianAccounts.createdAt, studentId: guardianStudents.studentId, studentName: students.name })
    .from(guardianAccounts).leftJoin(guardianStudents, eq(guardianAccounts.id, guardianStudents.guardianId)).leftJoin(students, eq(guardianStudents.studentId, students.id)).orderBy(guardianAccounts.fullName, students.name);
}

export async function listGuardianStudents(guardianId: number) {
  const db = requireDatabase(await getDb());
  const links = await db.select({ studentId: guardianStudents.studentId }).from(guardianStudents).where(eq(guardianStudents.guardianId, guardianId));
  const rows = await Promise.all(links.map(async link => {
    const [student] = await db.select({ id: students.id, name: students.name, guardianEmail: students.guardianEmail, guardianName: students.guardianName }).from(students).where(eq(students.id, link.studentId)).limit(1);
    const [enrollment] = await db.select({ className: enrollments.className, schoolYear: enrollments.schoolYear, enrollmentId: enrollments.id }).from(enrollments).where(and(eq(enrollments.studentId, link.studentId), eq(enrollments.status, "active"))).orderBy(desc(enrollments.id)).limit(1);
    return student ? { ...student, className: enrollment?.className ?? null, schoolYear: enrollment?.schoolYear ?? null, enrollmentNumber: enrollment ? `MAT-${String(enrollment.enrollmentId).padStart(8, "0")}` : null } : null;
  }));
  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function listGuardianNotifications(guardianId: number) {
  const db = requireDatabase(await getDb());
  return db.select({ id: guardianNotifications.id, studentId: guardianNotifications.studentId, studentName: students.name, kind: guardianNotifications.kind, title: guardianNotifications.title, body: guardianNotifications.body, readAt: guardianNotifications.readAt, createdAt: guardianNotifications.createdAt })
    .from(guardianNotifications).leftJoin(students, eq(guardianNotifications.studentId, students.id)).where(eq(guardianNotifications.guardianId, guardianId)).orderBy(desc(guardianNotifications.createdAt), desc(guardianNotifications.id));
}

export async function markGuardianNotificationRead(id: number, guardianId: number) {
  const db = requireDatabase(await getDb());
  await db.update(guardianNotifications).set({ readAt: new Date() }).where(and(eq(guardianNotifications.id, id), eq(guardianNotifications.guardianId, guardianId)));
  return true;
}

export async function listGuardianMessages(guardianId: number) {
  const db = requireDatabase(await getDb());
  return db.select({ id: guardianMessages.id, studentId: guardianMessages.studentId, studentName: students.name, senderName: guardianMessages.senderName, direction: guardianMessages.direction, subject: guardianMessages.subject, body: guardianMessages.body, createdAt: guardianMessages.createdAt, readAt: guardianMessages.readAt })
    .from(guardianMessages).leftJoin(students, eq(guardianMessages.studentId, students.id)).where(eq(guardianMessages.guardianId, guardianId)).orderBy(desc(guardianMessages.createdAt), desc(guardianMessages.id));
}

async function assertGuardianStudent(guardianId: number, studentId: number) {
  const db = requireDatabase(await getDb());
  const [link] = await db.select({ id: guardianStudents.id }).from(guardianStudents).where(and(eq(guardianStudents.guardianId, guardianId), eq(guardianStudents.studentId, studentId))).limit(1);
  if (!link) throw new TRPCError({ code: "FORBIDDEN", message: "Este aluno não pertence à sua conta familiar." });
}

export async function createGuardianMessage(input: { guardianId: number; studentId: number; subject: string; body: string }) {
  const db = requireDatabase(await getDb());
  await assertGuardianStudent(input.guardianId, input.studentId);
  const [created] = await db.insert(guardianMessages).values({ guardianId: input.guardianId, studentId: input.studentId, direction: "fromGuardian", subject: input.subject.trim(), body: input.body.trim() });
  return (await db.select().from(guardianMessages).where(eq(guardianMessages.id, created.insertId)).limit(1))[0];
}

export async function listSchoolMessages() {
  const db = requireDatabase(await getDb());
  return db.select({ id: guardianMessages.id, guardianId: guardianMessages.guardianId, guardianName: guardianAccounts.fullName, email: guardianAccounts.email, studentId: guardianMessages.studentId, studentName: students.name, senderName: guardianMessages.senderName, direction: guardianMessages.direction, subject: guardianMessages.subject, body: guardianMessages.body, createdAt: guardianMessages.createdAt, readAt: guardianMessages.readAt })
    .from(guardianMessages).leftJoin(guardianAccounts, eq(guardianMessages.guardianId, guardianAccounts.id)).leftJoin(students, eq(guardianMessages.studentId, students.id)).orderBy(desc(guardianMessages.createdAt), desc(guardianMessages.id));
}

export async function sendGuardianAnnouncement(input: { guardianId: number; studentId?: number; subject: string; body: string; senderName: string }) {
  const db = requireDatabase(await getDb());
  if (input.studentId) await assertGuardianStudent(input.guardianId, input.studentId);
  const [created] = await db.insert(guardianMessages).values({ guardianId: input.guardianId, studentId: input.studentId ?? null, direction: "fromSchool", senderName: normalizeMessageSenderName(input.senderName), subject: input.subject.trim(), body: input.body.trim() });
  await db.insert(guardianNotifications).values({ guardianId: input.guardianId, studentId: input.studentId ?? null, kind: "message", title: input.subject.trim(), body: input.body.trim() });
  return (await db.select().from(guardianMessages).where(eq(guardianMessages.id, created.insertId)).limit(1))[0];
}

export async function notifyGuardiansOfIncident(input: { studentId: number; title: string; body: string }) {
  const db = requireDatabase(await getDb());
  const links = await db.select({ guardianId: guardianStudents.guardianId }).from(guardianStudents).where(eq(guardianStudents.studentId, input.studentId));
  if (links.length) await db.insert(guardianNotifications).values(links.map(link => ({ guardianId: link.guardianId, studentId: input.studentId, kind: "incident" as const, title: input.title, body: input.body })));
}
