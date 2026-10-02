import { describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { GUARDIAN_COOKIE_NAME, guardianSessionMaxAge, makeGuardianSession } from "./guardianAccounts";

describe("sessão do portal familiar", () => {
  it("usa cookie e audiência separados do painel interno", async () => {
    vi.stubEnv("JWT_SECRET", "f".repeat(48));
    const token = await makeGuardianSession({ id: 42, sessionVersion: 3 });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    expect(GUARDIAN_COOKIE_NAME).toBe("school_guardian_session");
    expect(guardianSessionMaxAge).toBe(8 * 60 * 60 * 1000);
    expect(payload.sub).toBe("42");
    expect(payload.kind).toBe("guardian");
    expect(payload.version).toBe(3);
    expect(payload.aud).toBe("colegio-gestao-family");
    vi.unstubAllEnvs();
  });
});
