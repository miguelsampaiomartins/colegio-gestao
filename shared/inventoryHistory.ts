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
  | { kind: "sale" | "return"; saleId: number; rows: T[]; totalQuantity: number; createdAt: T["createdAt"] }
  | { kind: "single"; row: T };

/** Groups sale exits and cancelled-sale returns separately, including legacy movements. */
export function groupInventoryHistory<T extends InventoryHistoryLine>(rows: readonly T[]): InventoryHistoryGroup<T>[] {
  const groups: InventoryHistoryGroup<T>[] = [];
  const batches = new Map<string, Extract<InventoryHistoryGroup<T>, { saleId: number }>>();
  for (const row of rows) {
    const kind = row.type === "exit" ? "sale" : "return";
    const match = row.type === "exit" ? /^Venda #(\d+)$/.exec(row.reason ?? "") : /^Cancelamento da venda #(\d+)$/.exec(row.reason ?? "");
    const saleId = match ? Number(match[1]) : null;
    if (saleId === null || !Number.isSafeInteger(saleId) || saleId <= 0) {
      groups.push({ kind: "single", row });
      continue;
    }
    const key = `${kind}:${saleId}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { kind, saleId, rows: [], totalQuantity: 0, createdAt: row.createdAt };
      groups.push(batch);
      batches.set(key, batch);
    }
    batch.rows.push(row);
    batch.totalQuantity += row.quantity;
  }
  return groups;
}
