import { describe, expect, it } from "vitest";

describe("credenciais sandbox do Mercado Pago", () => {
  it.skipIf(!process.env.MERCADOPAGO_ACCESS_TOKEN)("aceita o Access Token de teste no endpoint leve de identidade", async () => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    expect(accessToken, "MERCADOPAGO_ACCESS_TOKEN não configurado").toBeTruthy();

    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { id?: number; site_id?: string };
    expect(body.id).toBeTypeOf("number");
  }, 15000);

  it.skipIf(!process.env.VITE_MERCADOPAGO_PUBLIC_KEY)("mantém a Public Key de teste configurada sem expô-la no código", () => {
    expect(process.env.VITE_MERCADOPAGO_PUBLIC_KEY, "VITE_MERCADOPAGO_PUBLIC_KEY não configurada").toMatch(/^APP_USR-/);
  });
});
