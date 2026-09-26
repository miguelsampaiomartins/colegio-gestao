import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing Manus authentication. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Local password accounts, separate from OAuth identities. No complete CPF is stored. */
export const staffAccounts = mysqlTable("staffAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 120 }).notNull(),
  role: mysqlEnum("role", ["owner", "staff"]).notNull(),
  ownerSlot: int("ownerSlot").unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: int("active").default(1).notNull(),
  sessionVersion: int("sessionVersion").default(1).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: bigint("lockedUntil", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  birthDate: varchar("birthDate", { length: 10 }),
  grade: varchar("grade", { length: 80 }).notNull(),
  guardianName: varchar("guardianName", { length: 160 }).notNull(),
  guardianPhone: varchar("guardianPhone", { length: 40 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  schoolYear: varchar("schoolYear", { length: 9 }).notNull(),
  className: varchar("className", { length: 80 }).notNull(),
  shift: mysqlEnum("shift", ["morning", "afternoon", "fulltime"]).default("morning").notNull(),
  status: mysqlEnum("status", ["active", "pending", "cancelled"]).default("active").notNull(),
  enrollmentDate: timestamp("enrollmentDate").defaultNow().notNull(),
});

/** A product, such as "Camiseta" or "Livro de matemática". */
export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  category: mysqlEnum("category", ["uniform", "book", "other"]).notNull(),
  size: varchar("size", { length: 30 }),
  quantity: int("quantity").default(0).notNull(),
  minQuantity: int("minQuantity").default(5).notNull(),
  unitPriceCents: int("unitPriceCents").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Product varieties, limited to 10 in the product registration UI. */
export const inventoryVariants = mysqlTable("inventoryVariants", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  quantity: int("quantity").default(0).notNull(),
  unitPriceCents: int("unitPriceCents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  variantId: int("variantId"),
  type: mysqlEnum("type", ["entry", "exit"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  totalCents: int("totalCents").default(0).notNull(),
  discountCents: int("discountCents").default(0).notNull(),
  discountType: mysqlEnum("discountType", ["fixed", "percentage"]).default("fixed").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "pix", "card", "other"]).default("other").notNull(),
  status: mysqlEnum("status", ["completed", "cancelled"]).default("completed").notNull(),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  itemId: int("itemId").notNull(),
  variantId: int("variantId").notNull(),
  quantity: int("quantity").notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  totalCents: int("totalCents").notNull(),
});

export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  type: mysqlEnum("type", ["absence", "late", "homework", "book", "uniform", "behavior", "other"]).notNull(),
  note: text("note").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  resolved: int("resolved").default(0).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type StaffAccount = typeof staffAccounts.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryVariant = typeof inventoryVariants.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
