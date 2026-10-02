import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  roleId: int("roleId"),
  ownerSlot: int("ownerSlot").unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: int("active").default(1).notNull(),
  sessionVersion: int("sessionVersion").default(1).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: bigint("lockedUntil", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Custom staff roles created by the owner; permissions are stored as a JSON array. */
export const staffRoles = mysqlTable("staffRoles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  permissions: text("permissions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Append-only operational events. Never store passwords, CPF, address, or request bodies here. */
export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  actorName: varchar("actorName", { length: 160 }).notNull(),
  actorRole: mysqlEnum("actorRole", ["owner", "staff"]).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: int("targetId"),
  summary: varchar("summary", { length: 240 }).notNull(),
  occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
}, table => [index("audit_actor_time_idx").on(table.actorUserId, table.occurredAt)]);

/** Diagnostic metadata only: actual encrypted dumps reside outside the project tree. */
export const backupRuns = mysqlTable("backupRuns", {
  id: int("id").autoincrement().primaryKey(),
  status: mysqlEnum("status", ["success", "failure"]).notNull(),
  filename: varchar("filename", { length: 255 }),
  bytes: bigint("bytes", { mode: "number" }),
  message: varchar("message", { length: 240 }),
  startedAt: bigint("startedAt", { mode: "number" }).notNull(),
  finishedAt: bigint("finishedAt", { mode: "number" }).notNull(),
});

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  birthDate: varchar("birthDate", { length: 10 }),
  grade: varchar("grade", { length: 80 }).notNull(),
  guardianName: varchar("guardianName", { length: 160 }).notNull(),
  guardianPhone: varchar("guardianPhone", { length: 40 }),
  cpf: varchar("cpf", { length: 11 }).unique(),
  guardianCpf: varchar("guardianCpf", { length: 11 }),
  address: text("address"),
  guardianEmail: varchar("guardianEmail", { length: 320 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
/** Contact numbers for the responsible adult; legacy guardianPhone remains available. */
export const studentPhones = mysqlTable("studentPhones", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  number: varchar("number", { length: 20 }).notNull(),
  position: int("position").default(0).notNull(),
});

/** Separate family identities; guardians never receive access to the staff panel. */
export const guardianAccounts = mysqlTable("guardianAccounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: int("active").default(1).notNull(),
  sessionVersion: int("sessionVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const guardianStudents = mysqlTable("guardianStudents", {
  id: int("id").autoincrement().primaryKey(),
  guardianId: int("guardianId").notNull(),
  studentId: int("studentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guardianNotifications = mysqlTable("guardianNotifications", {
  id: int("id").autoincrement().primaryKey(),
  guardianId: int("guardianId").notNull(),
  studentId: int("studentId"),
  kind: mysqlEnum("kind", ["incident", "message", "announcement"]).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guardianMessages = mysqlTable("guardianMessages", {
  id: int("id").autoincrement().primaryKey(),
  guardianId: int("guardianId").notNull(),
  studentId: int("studentId"),
  direction: mysqlEnum("direction", ["fromGuardian", "fromSchool"]).notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
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
  category: varchar("category", { length: 80 }).notNull(),
  size: varchar("size", { length: 30 }),
  quantity: int("quantity").default(0).notNull(),
  minQuantity: int("minQuantity").default(5).notNull(),
  unitPriceCents: int("unitPriceCents").default(0).notNull(),
  active: int("active").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Product categories managed by the owner. Built-in categories are seeded by migration. */
export const inventoryCategories = mysqlTable("inventoryCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  icon: varchar("icon", { length: 20 }).default("package").notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  /** Optional enrollment and the buyer/seller as they were at checkout. Existing sales remain null. */
  enrollmentId: int("enrollmentId"),
  studentName: varchar("studentName", { length: 160 }),
  enrollmentNumber: varchar("enrollmentNumber", { length: 24 }),
  schoolYear: varchar("schoolYear", { length: 9 }),
  className: varchar("className", { length: 80 }),
  guardianName: varchar("guardianName", { length: 160 }),
  guardianCpf: varchar("guardianCpf", { length: 11 }),
  guardianEmail: varchar("guardianEmail", { length: 320 }),
  guardianAddress: text("guardianAddress"),
  guardianPhones: text("guardianPhones"),
  sellerName: varchar("sellerName", { length: 160 }),
  sellerCnpj: varchar("sellerCnpj", { length: 14 }),
  sellerAddress: text("sellerAddress"),
  sellerPhone: varchar("sellerPhone", { length: 20 }),
  sellerEmail: varchar("sellerEmail", { length: 320 }),
  sellerConfigured: int("sellerConfigured").default(0).notNull(),
});

/** Name and optional contact details printed on new receipts; only the owner may edit. */
export const schoolProfile = mysqlTable("schoolProfile", {
  id: int("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  cnpj: varchar("cnpj", { length: 14 }),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
