import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  type: mysqlEnum("type", ["entry", "exit"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export type Student = typeof students.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
