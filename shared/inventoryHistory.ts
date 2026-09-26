export type InventoryHistoryLine = {
  id: number;
  itemId: number;
  variantId: number | null;
  itemName: string | null;
  variantName: string | null;
  type: "entry" | "exit";
  quantity: number;
  reason: string | null;
  createdAt: Date | string;
  unitPriceCents: number | null;
  fallbackUnitPriceCents: number | null;
};

export type InventoryHistoryGroup<T extends InventoryHistoryLine> =
  | { kind: "sale"; saleId: number; rows: T[]; totalQuantity: number; createdAt: T["createdAt"] }
  | { kind: "single"; row: T };

/** Groups historical stock exits by sale number without changing legacy records. */
export function groupInventoryHistory<T extends InventoryHistoryLine>(rows: readonly T[]): InventoryHistoryGroup<T>[] {
  const groups: InventoryHistoryGroup<T>[] = [];
  const sales = new Map<number, Extract<InventoryHistoryGroup<T>, { kind: "sale" }>>();
  for (const row of rows) {
    const match = row.type === "exit" ? /^Venda #(\d+)$/.exec(row.reason ?? "") : null;
    const saleId = match ? Number(match[1]) : null;
    if (saleId === null || !Number.isSafeInteger(saleId) || saleId <= 0) {
      groups.push({ kind: "single", row });
      continue;
    }
    let sale = sales.get(saleId);
    if (!sale) {
      sale = { kind: "sale", saleId, rows: [], totalQuantity: 0, createdAt: row.createdAt };
      groups.push(sale);
      sales.set(saleId, sale);
    }
    sale.rows.push(row);
    sale.totalQuantity += row.quantity;
  }
  return groups;
}
