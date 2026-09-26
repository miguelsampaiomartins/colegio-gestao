import { describe, expect, it } from "vitest";
import { normalizeRolePermissions } from "./localAccounts";

 describe("custom staff permissions", () => {
  it("keeps only supported modules and removes duplicates", () => {
    expect(normalizeRolePermissions(["inventory", "sales", "inventory", "unknown"])).toEqual(["inventory", "sales"]);
  });

  it("allows an empty function without granting implicit access", () => {
    expect(normalizeRolePermissions([])).toEqual([]);
  });
});
