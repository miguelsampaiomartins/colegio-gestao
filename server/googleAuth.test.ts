import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Request } from "express";
import { allowedGoogleEmails, authenticateGoogleRequest, googleAuthStatus, googleIdentityAllowed, googleOpenId, registerGoogleAuthRoutes } from "./googleAuth";

afterEach(() => vi.unstubAllEnvs());

describe("Google OAuth configuration", () => {
  it("keeps the existing Manus provider unless explicitly enabled", () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "");
    expect(googleAuthStatus().mode).toBe("manus");
  });

  it("fails closed and lists missing Google settings", () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "google");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "");
    vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("DATABASE_URL", "");
    const status = googleAuthStatus();
    expect(status.mode).toBe("google");
    expect(status.configured).toBe(false);
    expect(status.missing).toContain("GOOGLE_CLIENT_ID");
    expect(status.missing).toContain("GOOGLE_ALLOWED_EMAILS");
  });

  it("accepts only an exact localhost callback path for HTTP", () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "google");
    vi.stubEnv("GOOGLE_CLIENT_ID", "demo.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "fake-secret");
    vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "owner@gmail.com");
    vi.stubEnv("JWT_SECRET", "a".repeat(40));
    vi.stubEnv("DATABASE_URL", "mysql://test@localhost:3306/test");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/google/callback");
    expect(googleAuthStatus().configured).toBe(true);
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://another-host:3000/api/auth/google/callback");
    expect(googleAuthStatus().configured).toBe(false);
  });
});

describe("Google identity authorization", () => {
  it("normalizes permitted addresses and requires verified Gmail or Workspace identity", () => {
    const allowed = allowedGoogleEmails(" Owner@Gmail.com , second@school.edu ");
    expect(googleIdentityAllowed({ sub: "123", email: "owner@gmail.com", email_verified: true }, allowed)).toBe(true);
    expect(googleIdentityAllowed({ sub: "123", email: "second@school.edu", email_verified: true, hd: "school.edu" }, allowed)).toBe(true);
    expect(googleIdentityAllowed({ sub: "123", email: "second@school.edu", email_verified: true }, allowed)).toBe(false);
    expect(googleIdentityAllowed({ sub: "123", email: "owner@gmail.com", email_verified: false }, allowed)).toBe(false);
    expect(googleIdentityAllowed({ sub: "123", email: "stranger@gmail.com", email_verified: true }, allowed)).toBe(false);
  });

  it("derives a stable bounded user ID from Google sub", () => {
    expect(googleOpenId("person-123")).toEqual(googleOpenId("person-123"));
    expect(googleOpenId("person-123")).not.toEqual(googleOpenId("person-456"));
    expect(googleOpenId("person-123").length).toBeLessThanOrEqual(64);
  });

  it("rejects a forged or missing session before any database access", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "google");
    vi.stubEnv("GOOGLE_CLIENT_ID", "demo.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "fake-secret");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/google/callback");
    vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "owner@gmail.com");
    vi.stubEnv("JWT_SECRET", "a".repeat(40));
    vi.stubEnv("DATABASE_URL", "mysql://test@localhost:3306/test");
    expect(await authenticateGoogleRequest({ headers: {} } as Request)).toBeNull();
    expect(await authenticateGoogleRequest({ headers: { cookie: "app_session_id=forged" } } as Request)).toBeNull();
  });

  it("starts at Google with a state cookie and rejects forged callbacks", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "google");
    vi.stubEnv("GOOGLE_CLIENT_ID", "demo.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "fake-secret");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/google/callback");
    vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "owner@gmail.com");
    vi.stubEnv("JWT_SECRET", "a".repeat(40));
    vi.stubEnv("DATABASE_URL", "mysql://test@localhost:3306/test");
    const app = express();
    registerGoogleAuthRoutes(app);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No port");
      const origin = `http://127.0.0.1:${address.port}`;
      const response = await fetch(`${origin}/api/auth/google/start`, { redirect: "manual" });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("accounts.google.com");
      expect(response.headers.get("set-cookie")).toContain("google_oauth_state=");
      const forbidden = await fetch(`${origin}/api/auth/google/callback?code=fake&state=forged`);
      expect(forbidden.status).toBe(403);
      const malformed = await fetch(`${origin}/api/auth/google/callback?code=fake&state=${encodeURIComponent("é".repeat(64))}`, {
        headers: { Cookie: `google_oauth_state=${"a".repeat(64)}` },
      });
      expect(malformed.status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
