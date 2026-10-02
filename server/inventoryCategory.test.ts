import { describe, expect, it } from "vitest";
import { normalizeInventoryCategoryIcon } from "./db";

describe("ícones de categorias do estoque", () => {
  it("preserva os três ícones permitidos", () => {
    expect(normalizeInventoryCategoryIcon("shirt")).toBe("shirt");
    expect(normalizeInventoryCategoryIcon("package")).toBe("package");
    expect(normalizeInventoryCategoryIcon("book")).toBe("book");
  });

  it("usa caixa para categorias antigas ou valores inválidos", () => {
    expect(normalizeInventoryCategoryIcon(undefined)).toBe("package");
    expect(normalizeInventoryCategoryIcon("unknown")).toBe("package");
  });
});
