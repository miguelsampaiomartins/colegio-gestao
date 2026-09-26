import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  enrollments,
  incidents,
  inventoryCategories,
  inventoryItems,
  inventoryMovements,
  inventoryVariants,
  saleItems,
  schoolProfile,
  sales,
  studentPhones,
  students,
  users,
} from "../drizzle/schema";
import { formatEnrollmentNumber } from "../shared/enrollmentNumber";
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
    db.select({ value: sql<number>`count(*)` }).from(inventoryItems).where(and(eq(inventoryItems.active, 1), sql`${inventoryItems.quantity} <= ${inventoryItems.minQuantity}`)),
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
  const rows = await db.select().from(students).orderBy(students.name);
  if (!rows.length) return [];
  const phones = await db.select().from(studentPhones).where(inArray(studentPhones.studentId, rows.map(row => row.id))).orderBy(studentPhones.position, studentPhones.id);
  const byStudent = new Map<number, string[]>();
  for (const phone of phones) byStudent.set(phone.studentId, [...(byStudent.get(phone.studentId) ?? []), phone.number]);
  return rows.map(row => ({ ...row, phones: byStudent.get(row.id) ?? (row.guardianPhone ? [row.guardianPhone] : []) }));
}
export async function createStudent(input: Omit<typeof students.$inferInsert, "guardianPhone"> & { phones: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { phones, ...student } = input;
  try {
    return await db.transaction(async tx => {
      const [inserted] = await tx.insert(students).values({ ...student, guardianPhone: phones[0] });
      await tx.insert(studentPhones).values(phones.map((number, position) => ({ studentId: inserted.insertId, number, position })));
      const [created] = await tx.select().from(students).where(eq(students.id, inserted.insertId)).limit(1);
      return { ...created, phones };
    });
  } catch (error) {
    const dbError = error as { code?: string; cause?: { code?: string } };
    if (dbError.code === "ER_DUP_ENTRY" || dbError.cause?.code === "ER_DUP_ENTRY") {
      throw new TRPCError({ code: "CONFLICT", message: "Este CPF de aluno já está cadastrado." });
    }
    throw error;
  }
}

export async function listEnrollments() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: enrollments.id, studentId: enrollments.studentId, studentName: students.name, schoolYear: enrollments.schoolYear, className: enrollments.className, shift: enrollments.shift, status: enrollments.status, enrollmentDate: enrollments.enrollmentDate }).from(enrollments).leftJoin(students, eq(enrollments.studentId, students.id)).orderBy(desc(enrollments.enrollmentDate), desc(enrollments.id));
  return rows.map(row => ({ ...row, enrollmentNumber: formatEnrollmentNumber(row.id) }));
}

export async function getSchoolProfile() {
  const db = await getDb();
  if (!db) return null;
  const [profile] = await db.select().from(schoolProfile).where(eq(schoolProfile.id, 1)).limit(1);
  return profile ?? null;
}

export function normalizeSchoolCnpj(value?: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  if (digits && digits.length !== 14) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um CNPJ com 14 dígitos." });
  return digits || null;
}

export function normalizeSchoolPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  if (digits.length > 20) throw new TRPCError({ code: "BAD_REQUEST", message: "O telefone deve ter no máximo 20 dígitos." });
  return digits || null;
}

export async function saveSchoolProfile(input: { name: string; cnpj?: string | null; address?: string | null; phone?: string | null; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cnpj = normalizeSchoolCnpj(input.cnpj);
  const phone = normalizeSchoolPhone(input.phone);
  const values = { id: 1, name: input.name.trim(), cnpj, address: input.address?.trim() || null, phone, email: input.email?.trim() || null };
  await db.insert(schoolProfile).values(values).onDuplicateKeyUpdate({ set: { name: values.name, cnpj: values.cnpj, address: values.address, phone: values.phone, email: values.email, updatedAt: new Date() } });
  return getSchoolProfile();
}

export type SaleBuyerSource = {
  enrollment: { id: number; schoolYear: string; className: string };
  student: { name: string; guardianName: string; guardianCpf: string | null; guardianEmail: string | null; address: string | null; guardianPhone: string | null };
  phones: string[];
};

export function buildSaleBuyerSnapshot(source: SaleBuyerSource) {
  return {
    enrollmentId: source.enrollment.id,
    studentName: source.student.name,
    enrollmentNumber: formatEnrollmentNumber(source.enrollment.id),
    schoolYear: source.enrollment.schoolYear,
    className: source.enrollment.className,
    guardianName: source.student.guardianName,
    guardianCpf: source.student.guardianCpf,
    guardianEmail: source.student.guardianEmail,
    guardianAddress: source.student.address,
    guardianPhones: JSON.stringify(source.phones.length ? source.phones : source.student.guardianPhone ? [source.student.guardianPhone] : []),
  };
}

export function buildSaleSellerSnapshot(profile: { name: string; cnpj: string | null; address: string | null; phone: string | null; email: string | null } | null | undefined) {
  return { sellerName: profile?.name ?? "Colégio Gestão", sellerCnpj: profile?.cnpj ?? null, sellerAddress: profile?.address ?? null, sellerPhone: profile?.phone ?? null, sellerEmail: profile?.email ?? null, sellerConfigured: profile ? 1 : 0 };
}

export function isEligibleSaleEnrollment(status: "active" | "pending" | "cancelled") {
  return status === "active";
}

export async function createEnrollment(input: typeof enrollments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [inserted] = await db.insert(enrollments).values(input);
  const [row] = await db.select({ id: enrollments.id, studentId: enrollments.studentId, studentName: students.name, schoolYear: enrollments.schoolYear, className: enrollments.className, shift: enrollments.shift, status: enrollments.status, enrollmentDate: enrollments.enrollmentDate }).from(enrollments).leftJoin(students, eq(enrollments.studentId, students.id)).where(eq(enrollments.id, inserted.insertId)).limit(1);
  if (!row) throw new Error("Matrícula criada, mas não foi possível recuperar seus dados.");
  return { ...row, enrollmentNumber: formatEnrollmentNumber(row.id) };
}

export async function listInventory() {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(inventoryItems).where(eq(inventoryItems.active, 1)).orderBy(inventoryItems.category, inventoryItems.name);
  return Promise.all(items.map(async item => {
    const variants = await db.select().from(inventoryVariants).where(eq(inventoryVariants.itemId, item.id)).orderBy(inventoryVariants.id);
    return { ...item, variants };
  }));
}

export async function listInventoryCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryCategories).where(eq(inventoryCategories.active, 1)).orderBy(inventoryCategories.name);
}

export async function createInventoryCategory(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 80) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma categoria entre 2 e 80 caracteres." });
  try {
    const [created] = await db.insert(inventoryCategories).values({ name: cleanName });
    return (await db.select().from(inventoryCategories).where(eq(inventoryCategories.id, created.insertId)).limit(1))[0];
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Esta categoria já existe." });
    throw error;
  }
}

export async function updateInventoryMinimum(itemId: number, minQuantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(inventoryItems).set({ minQuantity, updatedAt: new Date() }).where(eq(inventoryItems.id, itemId));
  return (await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1))[0];
}

/** Archives a product from the active catalog while preserving its variants and movement/sale history. */
export async function deleteInventoryProduct(itemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [item] = await db.select({ id: inventoryItems.id, active: inventoryItems.active }).from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);
  if (!item || !item.active) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado ou já excluído." });
  await db.update(inventoryItems).set({ active: 0, updatedAt: new Date() }).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.active, 1)));
  return true;
}

export async function createInventoryProduct(input: { name: string; category: string; minQuantity: number; variants: Array<{ name: string; quantity: number; unitPriceCents: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.variants.length < 1 || input.variants.length > 10) throw new Error("O produto deve ter entre 1 e 10 variedades");
  const [category] = await db.select({ id: inventoryCategories.id }).from(inventoryCategories).where(and(eq(inventoryCategories.name, input.category), eq(inventoryCategories.active, 1))).limit(1);
  if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma categoria válida." });
  return db.transaction(async tx => {
    const quantity = input.variants.reduce((sum, variant) => sum + variant.quantity, 0);
    const price = input.variants[0]?.unitPriceCents ?? 0;
    await tx.insert(inventoryItems).values({ name: input.name, category: input.category, minQuantity: input.minQuantity, quantity, unitPriceCents: price });
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
  const item = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.active, 1))).limit(1);
  if (!item[0]) throw new Error("Produto não encontrado ou já excluído");
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
      const item = await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, line.itemId), eq(inventoryItems.active, 1))).limit(1);
      if (!item[0]) throw new Error("Um dos itens selecionados não foi encontrado ou já foi excluído");
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
      const [item] = await tx.select({ active: inventoryItems.active }).from(inventoryItems).where(and(eq(inventoryItems.id, line.itemId), eq(inventoryItems.active, 1))).limit(1);
      if (!item) throw new Error("Um dos produtos selecionados não foi encontrado ou já foi excluído");
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
    const [item] = await tx.select({ active: inventoryItems.active }).from(inventoryItems).where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.active, 1))).limit(1);
    if (!item) throw new Error("Produto não encontrado ou já excluído");
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

export async function updateInventoryVariantPrice(input: { variantId: number; unitPriceCents: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const variant = await db.select().from(inventoryVariants).where(eq(inventoryVariants.id, input.variantId)).limit(1);
  if (!variant[0]) throw new Error("Variedade não encontrada");
  await db.update(inventoryVariants).set({ unitPriceCents: input.unitPriceCents, updatedAt: new Date() }).where(eq(inventoryVariants.id, input.variantId));
  return (await db.select().from(inventoryVariants).where(eq(inventoryVariants.id, input.variantId)).limit(1))[0];
}

export async function listInventoryMovements() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: inventoryMovements.id, itemId: inventoryMovements.itemId, variantId: inventoryMovements.variantId, itemName: inventoryItems.name, variantName: inventoryVariants.name, itemSize: inventoryItems.size, category: inventoryItems.category, unitPriceCents: inventoryVariants.unitPriceCents, fallbackUnitPriceCents: inventoryItems.unitPriceCents, type: inventoryMovements.type, quantity: inventoryMovements.quantity, reason: inventoryMovements.reason, createdAt: inventoryMovements.createdAt }).from(inventoryMovements).leftJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id)).leftJoin(inventoryVariants, eq(inventoryMovements.variantId, inventoryVariants.id)).orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id));
}

export async function createSale(input: { enrollmentId?: number; discountType?: "fixed" | "percentage"; discountValue?: number; paymentMethod?: "cash" | "pix" | "card" | "other"; items: Array<{ itemId: number; variantId: number; quantity: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (!input.items.length) throw new Error("Adicione pelo menos um item à venda");
  return db.transaction(async tx => {
    const [profile] = await tx.select().from(schoolProfile).where(eq(schoolProfile.id, 1)).limit(1);
    let buyerSnapshot: Record<string, unknown> = {};
    if (input.enrollmentId) {
      const [selected] = await tx.select({ enrollment: enrollments, student: students }).from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(eq(enrollments.id, input.enrollmentId)).limit(1);
      if (!selected || !isEligibleSaleEnrollment(selected.enrollment.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "A matrícula selecionada não está ativa ou não foi encontrada." });
      const phones = await tx.select({ number: studentPhones.number }).from(studentPhones).where(eq(studentPhones.studentId, selected.student.id)).orderBy(studentPhones.position, studentPhones.id);
      buyerSnapshot = buildSaleBuyerSnapshot({ enrollment: selected.enrollment, student: selected.student, phones: phones.map(phone => phone.number) });
    }
    const normalizedItems = Array.from(input.items.reduce((map, line) => {
      const key = `${line.itemId}:${line.variantId}`;
      const previous = map.get(key);
      map.set(key, previous ? { ...previous, quantity: previous.quantity + line.quantity } : line);
      return map;
    }, new Map<string, { itemId: number; variantId: number; quantity: number } >()).values());
    const prepared: Array<{ itemId: number; variantId: number; quantity: number; unitPriceCents: number; totalCents: number; nextQuantity: number }> = [];
    for (const line of normalizedItems) {
      const [item] = await tx.select({ active: inventoryItems.active }).from(inventoryItems).where(and(eq(inventoryItems.id, line.itemId), eq(inventoryItems.active, 1))).limit(1);
      if (!item) throw new Error("Um dos produtos selecionados não foi encontrado ou já foi excluído");
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
    const paymentMethod = input.paymentMethod ?? "other";
    await tx.insert(sales).values({ totalCents, discountCents, discountType, paymentMethod, ...buyerSnapshot, ...buildSaleSellerSnapshot(profile) });
    const createdSale = await tx.select().from(sales).orderBy(desc(sales.id)).limit(1);
    const sale = createdSale[0];
    if (!sale) throw new Error("Não foi possível criar a venda");
    for (const line of prepared) {
      await tx.insert(saleItems).values({ saleId: sale.id, itemId: line.itemId, variantId: line.variantId, quantity: line.quantity, unitPriceCents: line.unitPriceCents, totalCents: line.totalCents });
      await tx.update(inventoryVariants).set({ quantity: line.nextQuantity, updatedAt: new Date() }).where(eq(inventoryVariants.id, line.variantId));
      await tx.update(inventoryItems).set({ quantity: sql`${inventoryItems.quantity} - ${line.quantity}`, updatedAt: new Date() }).where(eq(inventoryItems.id, line.itemId));
      await tx.insert(inventoryMovements).values({ itemId: line.itemId, variantId: line.variantId, type: "exit", quantity: line.quantity, reason: `Venda #${sale.id}` });
    }
    return { saleId: sale.id, subtotalCents, discountCents, discountType, paymentMethod, totalCents };
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

/** Returns the complete purchase history for a student across all of their enrollments. */
export async function listSalesByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  const studentEnrollments = await db.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.studentId, studentId));
  const enrollmentIds = studentEnrollments.map(enrollment => enrollment.id);
  if (!enrollmentIds.length) return [];
  const rows = await db.select().from(sales).where(inArray(sales.enrollmentId, enrollmentIds)).orderBy(desc(sales.createdAt), desc(sales.id));
  return Promise.all(rows.map(async sale => {
    const items = await db.select({ itemName: inventoryItems.name, variantName: inventoryVariants.name, quantity: saleItems.quantity, unitPriceCents: saleItems.unitPriceCents, totalCents: saleItems.totalCents }).from(saleItems).leftJoin(inventoryItems, eq(saleItems.itemId, inventoryItems.id)).leftJoin(inventoryVariants, eq(saleItems.variantId, inventoryVariants.id)).where(eq(saleItems.saleId, sale.id)).orderBy(saleItems.id);
    return { ...sale, items };
  }));
}

export async function cancelSale(saleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [claimed] = await tx.update(sales).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(sales.id, saleId), eq(sales.status, "completed")));
    if (claimed.affectedRows !== 1) {
      const [sale] = await tx.select({ id: sales.id }).from(sales).where(eq(sales.id, saleId)).limit(1);
      throw new Error(sale ? "Esta venda já foi cancelada" : "Venda não encontrada");
    }
    const lines = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    for (const line of lines) {
      await tx.update(inventoryVariants).set({ quantity: sql`${inventoryVariants.quantity} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventoryVariants.id, line.variantId));
      await tx.update(inventoryItems).set({ quantity: sql`${inventoryItems.quantity} + ${line.quantity}`, updatedAt: new Date() }).where(eq(inventoryItems.id, line.itemId));
      await tx.insert(inventoryMovements).values({ itemId: line.itemId, variantId: line.variantId, type: "entry", quantity: line.quantity, reason: `Cancelamento da venda #${saleId}` });
    }
    return { saleId, restoredItems: lines.length };
  });
}

export async function listIncidents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: incidents.id, studentId: incidents.studentId, studentName: students.name, type: incidents.type, note: incidents.note, occurredAt: incidents.occurredAt, resolved: incidents.resolved }).from(incidents).leftJoin(students, eq(incidents.studentId, students.id)).orderBy(desc(incidents.occurredAt));
}

/** Returns the complete disciplinary history for one student, newest first. */
export async function listIncidentsByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: incidents.id, studentId: incidents.studentId, studentName: students.name, type: incidents.type, note: incidents.note, occurredAt: incidents.occurredAt, resolved: incidents.resolved }).from(incidents).leftJoin(students, eq(incidents.studentId, students.id)).where(eq(incidents.studentId, studentId)).orderBy(desc(incidents.occurredAt), desc(incidents.id));
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
