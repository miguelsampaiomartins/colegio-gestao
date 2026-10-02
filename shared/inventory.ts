export const inventoryCategoryIconKeys = ["shirt", "package", "book"] as const;
export type InventoryCategoryIcon = (typeof inventoryCategoryIconKeys)[number];

export const inventoryCategoryIconLabels: Record<InventoryCategoryIcon, string> = {
  shirt: "Blusa",
  package: "Caixa",
  book: "Livro",
};
