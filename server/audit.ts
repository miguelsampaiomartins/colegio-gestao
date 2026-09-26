import { and, desc, eq, lt } from "drizzle-orm";
import { auditEvents, backupRuns, staffAccounts, type User } from "../drizzle/schema";
import { getDb } from "./db";
import type { LocalRole } from "./localAccounts";

export const actionLabels: Record<string, { label: string; targetType: string | null }> = {
  "auth.login": { label: "Entrou no sistema", targetType: null },
  "auth.logout": { label: "Saiu do sistema", targetType: null },
  "auth.changePassword": { label: "Alterou a própria senha", targetType: "staff" },
  "staff.create": { label: "Cadastrou funcionário", targetType: "staff" },
  "staff.setActive": { label: "Alterou o acesso de funcionário", targetType: "staff" },
  "staff.delete": { label: "Excluiu funcionário", targetType: "staff" },
  "staff.resetPassword": { label: "Redefiniu senha de funcionário", targetType: "staff" },
  "school.addStudent": { label: "Cadastrou aluno", targetType: "student" },
  "school.addEnrollment": { label: "Registrou matrícula", targetType: "enrollment" },
  "school.addInventoryProduct": { label: "Cadastrou produto", targetType: "inventory" },
  "school.addInventoryItem": { label: "Cadastrou item do estoque", targetType: "inventory" },
  "school.addInventoryVariant": { label: "Adicionou variedade", targetType: "inventory" },
  "school.addInventoryVariantUnits": { label: "Adicionou unidades ao estoque", targetType: "inventory" },
  "school.updateInventoryVariantPrice": { label: "Alterou preço de variedade", targetType: "inventory" },
  "school.deleteInventoryProduct": { label: "Excluiu produto do estoque", targetType: "inventory" },
  "school.inventoryMovement": { label: "Movimentou o estoque", targetType: "inventory" },
  "school.inventoryBulkMovement": { label: "Fez movimentação múltipla do estoque", targetType: "inventory" },
  "school.createSale": { label: "Finalizou venda", targetType: "sale" },
  "school.cancelSale": { label: "Cancelou venda", targetType: "sale" },
  "school.addIncident": { label: "Registrou anotação", targetType: "incident" },
  "school.resolveIncident": { label: "Resolveu anotação", targetType: "incident" },
};

/** Extract only database numeric IDs; do not persist any input text. */
export function safeTargetId(input?: unknown, result?: unknown): number | null {
  const output = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const fields = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const candidate = output.saleId ?? output.id ?? fields.saleId ?? fields.targetId ?? fields.variantId ?? fields.studentId ?? fields.itemId ?? fields.id;
  return typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0 ? candidate : null;
}

/** Never send request bodies, CPF, addresses, notes or passwords to this function. */
export async function recordAction(user: User, role: LocalRole | null | undefined, action: string, targetId?: number | null): Promise<void> {
  if (!role) return; // OAuth mode is not a local staff identity.
  const spec = actionLabels[action];
  if (!spec) throw new Error(`Unrecognized audit action: ${action}`);
  const db = await getDb();
  if (!db) throw new Error("Audit database unavailable");
  await db.insert(auditEvents).values({
    actorUserId: user.id,
    actorName: (user.name ?? "Usuário").slice(0, 160),
    actorRole: role,
    action,
    targetType: spec.targetType,
    targetId: spec.targetType && typeof targetId === "number" && Number.isSafeInteger(targetId) && targetId > 0 ? targetId : null,
    summary: spec.label,
    occurredAt: Date.now(),
  });
}

/** Logs only successful mutations; audit errors must not turn a committed sale into a retryable error. */
export async function safeRecordAction(user: User | null, role: LocalRole | null | undefined, action: string, targetId?: number | null) {
  if (!user || !role) return;
  try { await recordAction(user, role, action, targetId); }
  catch (error) { console.error(`[audit] Could not record ${action}:`, error); }
}

export async function listAuditEvents(params: { staffAccountId?: number; beforeId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const where = [];
  if (params.staffAccountId) {
    const [staff] = await db.select({ userId: staffAccounts.userId }).from(staffAccounts).where(eq(staffAccounts.id, params.staffAccountId)).limit(1);
    if (!staff) return [];
    where.push(eq(auditEvents.actorUserId, staff.userId));
  }
  if (params.beforeId) where.push(lt(auditEvents.id, params.beforeId));
  return db.select().from(auditEvents).where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditEvents.id)).limit(Math.min(Math.max(params.limit ?? 50, 1), 100));
}

export async function listBackupRuns() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(backupRuns).orderBy(desc(backupRuns.id)).limit(20);
}
