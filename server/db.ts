import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  enrollments,
  incidents,
  inventoryItems,
  inventoryMovements,
  students,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      const normalized = user[field] ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { students: 0, enrollments: 0, lowStock: 0, openIncidents: 0 };
  const [studentRows, enrollmentRows, stockRows, incidentRows] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(students).where(eq(students.status, "active")),
    db.select({ value: sql<number>`count(*)` }).from(enrollments).where(eq(enrollments.status, "active")),
    db.select({ value: sql<number>`count(*)` }).from(inventoryItems).where(sql`${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`),
    db.select({ value: sql<number>`count(*)` }).from(incidents).where(eq(incidents.resolved, 0)),
  ]);
  return {
    students: Number(studentRows[0]?.value ?? 0),
    enrollments: Number(enrollmentRows[0]?.value ?? 0),
    lowStock: Number(stockRows[0]?.value ?? 0),
    openIncidents: Number(incidentRows[0]?.value ?? 0),
  };
}

export async function listStudents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(students).orderBy(students.name);
}

export async function createStudent(input: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(students).values(input);
  const rows = await db.select().from(students).orderBy(desc(students.id)).limit(1);
  return rows[0];
}

export async function listEnrollments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      studentName: students.name,
      schoolYear: enrollments.schoolYear,
      className: enrollments.className,
      shift: enrollments.shift,
      status: enrollments.status,
      enrollmentDate: enrollments.enrollmentDate,
    })
    .from(enrollments)
    .leftJoin(students, eq(enrollments.studentId, students.id))
    .orderBy(desc(enrollments.enrollmentDate));
}

export async function createEnrollment(input: typeof enrollments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(enrollments).values(input);
  const rows = await listEnrollments();
  return rows[0];
}

export async function listInventory() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryItems).orderBy(inventoryItems.category, inventoryItems.name);
}

export async function createInventoryItem(input: typeof inventoryItems.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(inventoryItems).values(input);
  const rows = await db.select().from(inventoryItems).orderBy(desc(inventoryItems.id)).limit(1);
  return rows[0];
}

export async function recordInventoryMovement(input: { itemId: number; type: "entry" | "exit"; quantity: number; reason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const item = await db.select().from(inventoryItems).where(eq(inventoryItems.id, input.itemId)).limit(1);
  if (!item[0]) throw new Error("Item not found");
  const nextQuantity = item[0].quantity + (input.type === "entry" ? input.quantity : -input.quantity);
  if (nextQuantity < 0) throw new Error("Estoque insuficiente para esta saída");
  await db.insert(inventoryMovements).values(input);
  await db.update(inventoryItems).set({ quantity: nextQuantity, updatedAt: new Date() }).where(eq(inventoryItems.id, input.itemId));
  return (await db.select().from(inventoryItems).where(eq(inventoryItems.id, input.itemId)).limit(1))[0];
}

export async function recordInventoryMovements(input: { type: "entry" | "exit"; reason?: string; items: Array<{ itemId: number; quantity: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const prepared: Array<{ itemId: number; type: "entry" | "exit"; quantity: number; reason?: string; nextQuantity: number }> = [];
    for (const line of input.items) {
      const item = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, line.itemId)).limit(1);
      if (!item[0]) throw new Error("Um dos itens selecionados não foi encontrado");
      const nextQuantity = item[0].quantity + (input.type === "entry" ? line.quantity : -line.quantity);
      if (nextQuantity < 0) throw new Error(`Estoque insuficiente para ${item[0].name}`);
      prepared.push({ itemId: line.itemId, type: input.type, quantity: line.quantity, reason: input.reason, nextQuantity });
    }
    for (const line of prepared) {
      await tx.insert(inventoryMovements).values({ itemId: line.itemId, type: line.type, quantity: line.quantity, reason: line.reason });
      await tx.update(inventoryItems).set({ quantity: line.nextQuantity, updatedAt: new Date() }).where(eq(inventoryItems.id, line.itemId));
    }
    return prepared.length;
  });
}

export async function listInventoryMovements() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: inventoryMovements.id,
      itemId: inventoryMovements.itemId,
      itemName: inventoryItems.name,
      itemSize: inventoryItems.size,
      category: inventoryItems.category,
      unitPriceCents: inventoryItems.unitPriceCents,
      type: inventoryMovements.type,
      quantity: inventoryMovements.quantity,
      reason: inventoryMovements.reason,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .leftJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id))
    .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id));
}

export async function listIncidents() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: incidents.id,
      studentId: incidents.studentId,
      studentName: students.name,
      type: incidents.type,
      note: incidents.note,
      occurredAt: incidents.occurredAt,
      resolved: incidents.resolved,
    })
    .from(incidents)
    .leftJoin(students, eq(incidents.studentId, students.id))
    .orderBy(desc(incidents.occurredAt));
}

export async function createIncident(input: typeof incidents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(incidents).values(input);
  const rows = await listIncidents();
  return rows[0];
}

export async function resolveIncident(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(incidents).set({ resolved: 1 }).where(and(eq(incidents.id, id), eq(incidents.resolved, 0)));
  return (await db.select().from(incidents).where(eq(incidents.id, id)).limit(1))[0];
}
