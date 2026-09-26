import { describe, expect, it } from "vitest";
import { groupInventoryHistory, type InventoryHistoryLine } from "../shared/inventoryHistory";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { isValidCpf, normalizeBrazilianPhone } from "./studentValidation";

const movement = (id: number, type: "entry" | "exit", reason: string, itemName: string, quantity: number): InventoryHistoryLine => ({
  id, itemId: id, variantId: id, itemName, variantName: "M", type, quantity, reason,
  createdAt: new Date(`2026-09-26T0${Math.min(id, 9)}:00:00Z`), unitPriceCents: 2500, fallbackUnitPriceCents: 2500,
});

describe("dados escolares", () => {
  it("valida os dois dígitos do CPF e recusa números repetidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123" )).toBe(false);
  });
  it("normaliza telefones brasileiros sem perder DDD", () => {
    expect(normalizeBrazilianPhone("+55 (11) 99999-9999")).toBe("11999999999");
    expect(normalizeBrazilianPhone("(21) 3333-4444")).toBe("2133334444");
  });
  it("reúne blusas e calças da mesma venda em uma saída com quantidades separadas", () => {
    const rows = [movement(5, "exit", "Venda #8", "Blusa", 2), movement(4, "entry", "Cancelamento da venda #7", "Calça", 1), movement(3, "exit", "Venda #8", "Calça", 2), movement(2, "exit", "Venda #7", "Livro", 1), movement(1, "entry", "Reposição", "Blusa", 5)];
    const grouped = groupInventoryHistory(rows);
    expect(grouped.map(group => group.kind === "sale" ? `Venda #${group.saleId}` : group.row.reason)).toEqual(["Venda #8", "Cancelamento da venda #7", "Venda #7", "Reposição"]);
    expect(grouped[0]).toMatchObject({ kind: "sale", saleId: 8, totalQuantity: 4, rows: [{ itemName: "Blusa", quantity: 2 }, { itemName: "Calça", quantity: 2 }] });
    expect(grouped[1]).toMatchObject({ kind: "single", row: { type: "entry" } });
  });
  it("não agrupa saídas manuais nem motivos de venda que não correspondam exatamente ao padrão", () => {
    expect(groupInventoryHistory([movement(2, "exit", "Venda #2 - troca", "Calça", 1), movement(1, "exit", "Saída avulsa", "Blusa", 1)])).toHaveLength(2);
  });
  it("recusa CPF inválido e telefones duplicados antes de acessar o banco", async () => {
    const ctx = { user: { id: 1, openId: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const valid = { name: "Aluno Exemplo", grade: "5º ano", guardianName: "Responsável Exemplo", cpf: "529.982.247-25", guardianCpf: "168.995.350-09", address: "Rua de Exemplo, 123", guardianEmail: "teste@example.invalid", phones: ["(11) 99999-9999"] };
    await expect(caller.school.addStudent({ ...valid, cpf: "111.111.111-11" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.school.addStudent({ ...valid, phones: ["+55 (11) 99999-9999", "11999999999"] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
