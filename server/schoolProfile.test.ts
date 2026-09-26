import { describe, expect, it } from "vitest";
import { normalizeSchoolCnpj, normalizeSchoolPhone } from "./db";

describe("perfil do colégio", () => {
  it("remove pontuação do CNPJ antes de gravar no varchar(14)", () => {
    expect(normalizeSchoolCnpj("12.345.678/0001-90")).toBe("12345678000190");
    expect(() => normalizeSchoolCnpj("12.345.678/0001-9")).toThrow("14 dígitos");
  });

  it("remove máscara do telefone e recusa excesso de dígitos", () => {
    expect(normalizeSchoolPhone("(11) 99999-9999")).toBe("11999999999");
    expect(normalizeSchoolPhone("")).toBeNull();
    expect(() => normalizeSchoolPhone("123456789012345678901")).toThrow("20 dígitos");
  });
});
