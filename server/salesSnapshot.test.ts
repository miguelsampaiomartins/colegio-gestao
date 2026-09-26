import { describe, expect, it } from "vitest";
import { buildSaleBuyerSnapshot, buildSaleSellerSnapshot, isEligibleSaleEnrollment } from "./db";

describe("snapshots de recibos", () => {
  it("permite somente matrícula ativa no checkout", () => {
    expect(isEligibleSaleEnrollment("active")).toBe(true);
    expect(isEligibleSaleEnrollment("pending")).toBe(false);
    expect(isEligibleSaleEnrollment("cancelled")).toBe(false);
  });

  it("gera uma fotografia completa da matrícula e usa o número estável", () => {
    const source = {
      enrollment: { id: 42, schoolYear: "2026", className: "5º A" },
      student: { name: "Ana Souza", guardianName: "Maria Souza", guardianCpf: "52998224725", guardianEmail: "maria@example.com", address: "Rua das Flores, 10", guardianPhone: "11999999999" },
      phones: ["11988887777", "11999999999"],
    };
    const snapshot = buildSaleBuyerSnapshot(source);
    expect(snapshot).toEqual({ enrollmentId: 42, studentName: "Ana Souza", enrollmentNumber: "MAT-00000042", schoolYear: "2026", className: "5º A", guardianName: "Maria Souza", guardianCpf: "52998224725", guardianEmail: "maria@example.com", guardianAddress: "Rua das Flores, 10", guardianPhones: '["11988887777","11999999999"]' });
    source.student.name = "Ana Souza Editada";
    source.student.address = "Novo endereço";
    expect(snapshot.studentName).toBe("Ana Souza");
    expect(snapshot.guardianAddress).toBe("Rua das Flores, 10");
  });

  it("usa o telefone legado quando não há linhas múltiplas cadastradas", () => {
    const snapshot = buildSaleBuyerSnapshot({ enrollment: { id: 7, schoolYear: "2026", className: "1º B" }, student: { name: "João", guardianName: "Paulo", guardianCpf: null, guardianEmail: null, address: null, guardianPhone: "1133334444" }, phones: [] });
    expect(snapshot.guardianPhones).toBe('["1133334444"]');
  });

  it("mantém vendas antigas identificadas pelo padrão sem inventar dados", () => {
    expect(buildSaleSellerSnapshot(null)).toEqual({ sellerName: "Colégio Gestão", sellerCnpj: null, sellerAddress: null, sellerPhone: null, sellerEmail: null, sellerConfigured: 0 });
  });

  it("copia os dados institucionais atuais para cada nova venda", () => {
    const profile = { name: "Colégio Sol", cnpj: "12345678000199", address: "Av. Central, 20", phone: "1130000000", email: "contato@sol.com" };
    const snapshot = buildSaleSellerSnapshot(profile);
    profile.name = "Colégio Sol Editado";
    expect(snapshot).toMatchObject({ sellerName: "Colégio Sol", sellerCnpj: "12345678000199", sellerConfigured: 1 });
  });
});
