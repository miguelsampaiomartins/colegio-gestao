import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  enrollments,
  incidents,
  inventoryItems,
  inventoryMovements,
  inventoryVariants,
  saleItems,
  sales,
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
  return db.select({ id: enrollments.id, studentId: enrollments.studentId, studentName: students.name, schoolYear: enrollments.schoolYear, className: enrollments.className, shift: enrollments.shift, status: enrollments.status, enrollmentDate: enrollments.enrollmentDate }).from(enrollments).leftJoin(students, eq(enrollments.studentId, students.id)).orderBy(desc(enrollments.enrollmentDate));
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
  const items = await db.select().from(inventoryItems).orderBy(inventoryItems.category, inventoryItems.name);
  return Promise.all(items.map(async item => {
    const variants = await db.select().from(inventoryVariants).where(eq(inventoryVariants.itemId, item.id)).orderBy(inventoryVariants.id);
    return { ...item, variants };
  }));
}

export async function createInventoryProduct(input: { name: string; category: "uniform" | "book" | "other"; variants: Array<{ name: string; quantity: number; unitPriceCents: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.variants.length < 1 || input.variants.length > 10) throw new Error("O produto deve ter entre 1 e 10 variedades");
  return db.transaction(async tx => {
    const quantity = input.variants.reduce((sum, variant) => sum + variant.quantity, 0);
    const price = input.variants[0]?.unitPriceCents ?? 0;
    await tx.insert(inventoryItems).values({ name: input.name, category: input.category, quantity, unitPriceCents: price });
    const created = await tx.select().from(inventoryItems).orderBy(desc(inventoryItems.id)).limit(1);
    const item = created[0];
    if (!item) throw new Error("Não foi possível criar o produto");
    await tx.insert(inventoryVariants).values(input.variants.map(variant => ({ itemId: item.id, name: variant.name, quantity: variant.quantity, unitPriceCents: variant.unitPriceCents })));
    return item;
  });
}

/** Kept for compatibility with older callers. */
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

export async function addInventoryVariantUnits(input: { reason?: string; items: Array<{ itemId: number; variantId: number; quantity: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (!input.items.length) throw new Error("Informe pelo menos uma quantidade");
  return db.transaction(async tx => {
    for (const line of input.items) {
      const variant = await tx.select().from(inventoryVariants).where(and(eq(inventoryVariants.id, line.variantId), eq(inventoryVariants.itemId, line.itemId))).limit(1);
      if (!variant[0]) throw new Error("Uma das variedades selecionadas não foi encontrada");
      await tx.update(inventoryVariants).set({ quantity: sql`${inventoryVariants.quantity} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventoryVariants.id, line.variantId));
      await tx.update(inventoryItems).set({ quantity: sql`${inventoryItems.quantity} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventoryItems.id, line.itemId));
      await tx.insert(inventoryMovements).values({ itemId: line.itemId, variantId: line.variantId, type: "entry", quantity: line.quantity, reason: input.reason ?? "Reposição de estoque" });
    }
    return input.items.length;
  });
}

export async function addInventoryVariant(input: { itemId: number; name: string; quantity: number; unitPriceCents: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const existing = await tx.select().from(inventoryVariants).where(eq(inventoryVariants.itemId, input.itemId));
    if (existing.length >= 10) throw new Error("Cada produto pode ter no máximo 10 variedades");
    await tx.insert(inventoryVariants).values({ itemId: input.itemId, name: input.name, quantity: input.quantity, unitPriceCents: input.unitPriceCents });
    await tx.update(inventoryItems).set({ quantity: sql`${inventoryItems.quantity} + ${input.quantity}`, updatedAt: new Date() }).where(eq(inventoryItems.id, input.itemId));
    const created = await tx.select().from(inventoryVariants).where(eq(inventoryVariants.itemId, input.itemId)).orderBy(desc(inventoryVariants.id)).limit(1);
    const variant = created[0];
    if (!variant) throw new Error("Não foi possível criar a variedade");
    await tx.insert(inventoryMovements).values({ itemId: input.itemId, variantId: variant.id, type: "entry", quantity: input.quantity, reason: "Nova variedade cadastrada" });
    return variant;
  });
}

export async function listInventoryMovements() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: inventoryMovements.id, itemId: inventoryMovements.itemId, variantId: inventoryMovements.variantId, itemName: inventoryItems.name, variantName: inventoryVariants.name, itemSize: inventoryItems.size, category: inventoryItems.category, unitPriceCents: inventoryVariants.unitPriceCents, fallbackUnitPriceCents: inventoryItems.unitPriceCents, type: inventoryMovements.type, quantity: inventoryMovements.quantity, reason: inventoryMovements.reason, createdAt: inventoryMovements.createdAt }).from(inventoryMovements).leftJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id)).leftJoin(inventoryVariants, eq(inventoryMovements.variantId, inventoryVariants.id)).orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id));
}

export async function createSale(input: { discountType?: "fixed" | "percentage"; discountValue?: number; items: Array<{ itemId: number; variantId: number; quantity: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (!input.items.length) throw new Error("Adicione pelo menos um item à venda");
  return db.transaction(async tx => {
    const normalizedItems = Array.from(input.items.reduce((map, line) => {
      const key = `${line.itemId}:${line.variantId}`;
      const previous = map.get(key);
      map.set(key, previous ? { ...previous, quantity: previous.quantity + line.quantity } : line);
      return map;
    }, new Map<string, { itemId: number; variantId: number; quantity: number } >()).values());
    const prepared: Array<{ itemId: number; variantId: number; quantity: number; unitPriceCents: number; totalCents: number; nextQuantity: number }> = [];
    for (const line of normalizedItems) {
      const variant = await tx.select().from(inventoryVariants).where(and(eq(inventoryVariants.id, line.variantId), eq(inventoryVariants.itemId, line.itemId))).limit(1);
      if (!variant[0]) throw new Error("Uma das variedades selecionadas não foi encontrada");
      const nextQuantity = variant[0].quantity - line.quantity;
      if (nextQuantity < 0) throw new Error(`Estoque insuficiente para ${variant[0].name}`);
      prepared.push({ itemId: line.itemId, variantId: line.variantId, quantity: line.quantity, unitPriceCents: variant[0].unitPriceCents, totalCents: variant[0].unitPriceCents * line.quantity, nextQuantity });
    }
    const subtotalCents = prepared.reduce((sum, line) => sum + line.totalCents, 0);
    const discountType = input.discountType ?? "fixed";
    const discountValue = Math.max(input.discountValue ?? 0, 0);
    const requestedDiscountCents = discountType === "percentage" ? Math.round(subtotalCents * Math.min(discountValue, 100) / 100) : Math.round(discountValue * 100);
    const discountCents = Math.min(requestedDiscountCents, subtotalCents);
    const totalCents = subtotalCents - discountCents;
    await tx.insert(sales).values({ totalCents, discountCents });
    const createdSale = await tx.select().from(sales).orderBy(desc(sales.id)).limit(1);
    const sale = createdSale[0];
    if (!sale) throw new Error("Não foi possível criar a venda");
    for (const line of prepared) {
      await tx.insert(saleItems).values({ saleId: sale.id, itemId: line.itemId, variantId: line.variantId, quantity: line.quantity, unitPriceCents: line.unitPriceCents, totalCents: line.totalCents });
      await tx.update(inventoryVariants).set({ quantity: line.nextQuantity, updatedAt: new Date() }).where(eq(inventoryVariants.id, line.variantId));
      await tx.update(inventoryItems).set({ quantity: sql`${inventoryItems.quantity} - ${line.quantity}`, updatedAt: new Date() }).where(eq(inventoryItems.id, line.itemId));
      await tx.insert(inventoryMovements).values({ itemId: line.itemId, variantId: line.variantId, type: "exit", quantity: line.quantity, reason: `Venda #${sale.id}` });
    }
    return { saleId: sale.id, subtotalCents, discountCents, totalCents };
  });
}

export async function listSales() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(sales).orderBy(desc(sales.createdAt), desc(sales.id)).limit(30);
  return Promise.all(rows.map(async sale => {
    const items = await db.select({ itemName: inventoryItems.name, variantName: inventoryVariants.name, quantity: saleItems.quantity, unitPriceCents: saleItems.unitPriceCents, totalCents: saleItems.totalCents }).from(saleItems).leftJoin(inventoryItems, eq(saleItems.itemId, inventoryItems.id)).leftJoin(inventoryVariants, eq(saleItems.variantId, inventoryVariants.id)).where(eq(saleItems.saleId, sale.id)).orderBy(saleItems.id);
    return { ...sale, items };
  }));
}

export async function listIncidents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: incidents.id, studentId: incidents.studentId, studentName: students.name, type: incidents.type, note: incidents.note, occurredAt: incidents.occurredAt, resolved: incidents.resolved }).from(incidents).leftJoin(students, eq(incidents.studentId, students.id)).orderBy(desc(incidents.occurredAt));
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
