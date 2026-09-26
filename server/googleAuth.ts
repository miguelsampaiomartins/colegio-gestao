import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookies } from "cookie";
import type { Express, Request } from "express";
import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME } from "../shared/const";
import type { User } from "../drizzle/schema";
import { getUserByOpenId, upsertUser } from "./db";

const STATE_COOKIE = "google_oauth_state";
const SESSION_ISSUER = "colegio-gestao-google";
const SESSION_AUDIENCE = "colegio-gestao";
const STATE_MAX_AGE = 10 * 60 * 1000;
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

export function googleModeEnabled() {
  return process.env.VITE_AUTH_PROVIDER === "google";
}

export function allowedGoogleEmails(value: string | undefined = process.env.GOOGLE_ALLOWED_EMAILS) {
  return new Set((value ?? "").split(/[,;\n]/).map(email => email.trim().toLowerCase()).filter(Boolean));
}

function validRedirectUri(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.pathname === "/api/auth/google/callback" && !url.search && !url.hash &&
      (url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost"));
  } catch {
    return false;
  }
}

export function googleAuthStatus() {
  if (!googleModeEnabled()) {
    return { mode: "manus" as const, configured: Boolean(process.env.VITE_APP_ID && process.env.VITE_OAUTH_PORTAL_URL), missing: [] as string[] };
  }
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!validRedirectUri(process.env.GOOGLE_REDIRECT_URI)) missing.push("GOOGLE_REDIRECT_URI");
  if (allowedGoogleEmails().size === 0) missing.push("GOOGLE_ALLOWED_EMAILS");
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) missing.push("JWT_SECRET (mínimo 32 caracteres)");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  return { mode: "google" as const, configured: missing.length === 0, missing };
}

export function googleOpenId(sub: string) {
  // Google subject is stable; keep the identifier below the users.openId 64-char limit.
  return `google:${createHash("sha256").update(sub).digest("hex").slice(0, 56)}`;
}

export function googleIdentityAllowed(
  profile: { sub?: string; email?: string; email_verified?: boolean; hd?: string },
  allowed: Set<string> = allowedGoogleEmails(),
) {
  const email = profile.email?.trim().toLowerCase() ?? "";
  if (!profile.sub || !profile.email_verified || !allowed.has(email)) return false;
  // Google is authoritative for Gmail and for verified Workspace hosted domains.
  return email.endsWith("@gmail.com") || Boolean(profile.hd && email.endsWith(`@${profile.hd.toLowerCase()}`));
}

function isSecure(req: Request) {
  const forwarded = req.headers["x-forwarded-proto"];
  return req.secure || req.protocol === "https" ||
    (typeof forwarded === "string" && forwarded.split(",").some(value => value.trim() === "https"));
}

export function googleSessionCookieOptions(req: Request) {
  return { httpOnly: true as const, sameSite: "lax" as const, secure: isSecure(req), path: "/" as const };
}

function readCookie(req: Request, name: string) {
  return parseCookies(req.headers.cookie ?? "")[name];
}

function sameState(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected || !/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function oauthClient() {
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

async function signGoogleSession(user: User) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  return new SignJWT({ provider: "google" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(user.openId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function authenticateGoogleRequest(req: Request): Promise<User | null> {
  if (!googleAuthStatus().configured) return null;
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (payload.provider !== "google" || typeof payload.sub !== "string" || !payload.sub.startsWith("google:")) return null;
    const user = await getUserByOpenId(payload.sub);
    if (user?.loginMethod !== "google" || !user.email || !allowedGoogleEmails().has(user.email.toLowerCase())) return null;
    return user;
  } catch {
    return null;
  }
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/start", (req, res) => {
    const status = googleAuthStatus();
    if (status.mode !== "google") return res.sendStatus(404);
    if (!status.configured) return res.status(503).send("Configure o Google OAuth no arquivo .env e reinicie o servidor.");
    const state = randomBytes(32).toString("hex");
    const options = googleSessionCookieOptions(req);
    res.set("Cache-Control", "no-store");
    res.cookie(STATE_COOKIE, state, { ...options, maxAge: STATE_MAX_AGE });
    const url = oauthClient().generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
      nonce: state,
      prompt: "select_account",
    });
    return res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const status = googleAuthStatus();
    if (status.mode !== "google") return res.sendStatus(404);
    if (!status.configured) return res.sendStatus(503);
    res.set("Cache-Control", "no-store");
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!sameState(state, readCookie(req, STATE_COOKIE))) return res.status(403).send("Login expirado ou inválido. Volte ao sistema e tente novamente.");
    res.clearCookie(STATE_COOKIE, googleSessionCookieOptions(req));
    if (req.query.error) return res.redirect("/?login_error=cancelled");
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    if (!code) return res.status(400).send("Código de autenticação ausente.");
    try {
      const client = oauthClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) throw new Error("Google não retornou um ID token");
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      const profile = ticket.getPayload();
      if (!profile || profile.nonce !== state) return res.status(403).send("Resposta de autenticação inválida.");
      if (!googleIdentityAllowed(profile)) return res.status(403).send("Conta Google não autorizada. Use um e-mail permitido pelo administrador.");
      const openId = googleOpenId(profile.sub);
      await upsertUser({ openId, email: profile.email!.trim().toLowerCase(), name: profile.name ?? profile.email!, loginMethod: "google", lastSignedIn: new Date() });
      const user = await getUserByOpenId(openId);
      if (!user) throw new Error("Usuário não pôde ser salvo no banco");
      const session = await signGoogleSession(user);
      res.cookie(COOKIE_NAME, session, { ...googleSessionCookieOptions(req), maxAge: SESSION_MAX_AGE });
      return res.redirect("/");
    } catch (error) {
      console.error("[Google OAuth] Falha ao concluir o login:", error);
      return res.redirect("/?login_error=google_auth_failed");
    }
  });
}
