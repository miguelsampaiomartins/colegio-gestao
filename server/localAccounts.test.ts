import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { hashPassword, verifyPassword, makeUsername, localAuthStatus, localModeEnabled, makeLocalSession, LOCAL_COOKIE_NAME } from "./localAccounts";
import type { TrpcContext } from "./_core/context";

afterEach(() => vi.unstubAllEnvs());

function fakeContext(role: "owner" | "staff" | null): TrpcContext {
  return {
    localRole: role,
    user: role ? ({ id: 42, openId: "local:sample", loginMethod: "password", name: "Test User", role: role === "owner" ? "admin" : "user" } as NonNullable<TrpcContext["user"]>) : null,
    req: { protocol: "http", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("login por senha", () => {
  it("forma o nome de usuário com o primeiro nome normalizado e quatro dígitos", () => {
    expect(makeUsername("Amánda Sampaio", "0421")).toBe("amanda0421");
    expect(() => makeUsername("Ana", "12345")).toThrow();
    expect(() => makeUsername("Ana", "12ab")).toThrow();
  });
  it("protege a senha com sal aleatório e recusa senha incorreta", async () => {
    const first = await hashPassword("uma frase longa de teste 123");
    const second = await hashPassword("uma frase longa de teste 123");
    expect(first).not.toBe(second);
    expect(first).not.toContain("uma frase longa");
    expect(await verifyPassword("uma frase longa de teste 123", first)).toBe(true);
    expect(await verifyPassword("senha incorreta grande", first)).toBe(false);
    expect(await verifyPassword("uma frase longa de teste 123", "scrypt$invalid")).toBe(false);
    expect(() => makeUsername("A", "0000")).toThrow();
    await expect(hashPassword("12345678")).resolves.toMatch(/^scrypt\$/);
    await expect(hashPassword("1234567")).rejects.toThrow();
  });
  it("exige uma chave longa e oferece um cookie de sessão separado do Google", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "password");
    vi.stubEnv("DATABASE_URL", "mysql://demo:demo@127.0.0.1/teste");
    vi.stubEnv("JWT_SECRET", "01234567890123456789012345678901");
    expect(localAuthStatus().configured).toBe(true);
    expect(LOCAL_COOKIE_NAME).toBe("school_local_session");
    const token = await makeLocalSession({ id: 7, sessionVersion: 3 });
    expect(token.split(".")).toHaveLength(3);
  });
  it("mantém o acesso administrativo exclusivamente no login local", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "password");
    expect(localModeEnabled()).toBe(true);
    await expect(appRouter.createCaller(fakeContext("staff")).staff.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(fakeContext(null)).staff.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("protege exclusão de funcionário e produto para funções sem permissão", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "password");
    const caller = appRouter.createCaller(fakeContext("staff"));
    await expect(caller.staff.delete({ targetId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.school.deleteInventoryProduct({ itemId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.school.incidentsByStudent({ studentId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("faz logout limpando apenas o cookie de senha no modo local", async () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "password");
    const context = fakeContext("staff");
    await appRouter.createCaller(context).auth.logout();
    expect(context.res.clearCookie).toHaveBeenCalledWith(LOCAL_COOKIE_NAME, expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
  });
});
