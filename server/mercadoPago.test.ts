import { afterEach, describe, expect, it, vi } from "vitest";

const paymentResponse = {
  id: 987654321,
  status: "pending",
  status_detail: "pending_waiting_payment",
  transaction_amount: 12.34,
  point_of_interaction: {
    transaction_data: {
      qr_code: "000201010212TESTEPIX",
      qr_code_base64: "cXItY29kZQ==",
      ticket_url: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=test",
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("cliente Mercado Pago Pix", () => {
  it("cria Pix sandbox usando Access Token apenas no header", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "test-token-not-real");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(paymentResponse), { status: 201 }));
    vi.stubGlobal("fetch", request);
    const { createMercadoPagoPix } = await import("./mercadoPago");

    const result = await createMercadoPagoPix({ amountCents: 1234, description: "Teste de venda escolar" });

    expect(result).toMatchObject({ paymentId: "987654321", status: "pending", amountCents: 1234, qrCode: "000201010212TESTEPIX" });
    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token-not-real");
    expect(JSON.parse(String(init.body))).toMatchObject({ transaction_amount: 12.34, payment_method_id: "pix" });
  });

  it("consulta o status por identificador sem expor a credencial", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "test-token-not-real");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 987654321, status: "approved", status_detail: "accredited", transaction_amount: 12.34 }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const { getMercadoPagoPayment } = await import("./mercadoPago");

    await expect(getMercadoPagoPayment("987654321")).resolves.toMatchObject({ paymentId: "987654321", status: "approved", amountCents: 1234 });
    expect(request.mock.calls[0][0]).toBe("https://api.mercadopago.com/v1/payments/987654321");
  });
});
