import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

const API_BASE = "https://api.mercadopago.com";

type MercadoPagoPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  transaction_amount?: number;
  date_approved?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

const ensureConfigured = () => {
  if (!ENV.mercadoPagoAccessToken) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Mercado Pago não está configurado para testes." });
  }
};

const mercadoPagoRequest = async <T>(path: string, init: RequestInit = {}) => {
  ensureConfigured();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ENV.mercadoPagoAccessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "O Mercado Pago recusou a solicitação de teste." });
  }
  return payload as T;
};

export async function createMercadoPagoPix(input: { amountCents: number; description: string; payerEmail?: string }) {
  const payload = await mercadoPagoRequest<MercadoPagoPaymentResponse>("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": randomUUID() },
    body: JSON.stringify({
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: "pix",
      payer: { email: input.payerEmail || "test_user_123456789@testuser.com" },
    }),
  });
  const transactionData = payload?.point_of_interaction?.transaction_data;
  if (!payload?.id || !transactionData?.qr_code) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "O Mercado Pago não retornou os dados do Pix de teste." });
  }
  return {
    paymentId: String(payload.id),
    status: payload.status ?? "pending",
    statusDetail: payload.status_detail ?? null,
    amountCents: Math.round((payload.transaction_amount ?? input.amountCents / 100) * 100),
    qrCode: transactionData.qr_code,
    qrCodeBase64: transactionData.qr_code_base64 ?? null,
    ticketUrl: transactionData.ticket_url ?? null,
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const payload = await mercadoPagoRequest<MercadoPagoPaymentResponse>(`/v1/payments/${paymentId}`);
  return {
    paymentId: String(payload.id ?? paymentId),
    status: payload.status ?? "unknown",
    statusDetail: payload.status_detail ?? null,
    amountCents: Math.round((payload.transaction_amount ?? 0) * 100),
    dateApproved: payload.date_approved ?? null,
  };
}
