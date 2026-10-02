import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { LOCAL_COOKIE_NAME, addStaff, changeOwnPassword, listStaff, localAuthStatus, localCookieOptions,
  localModeEnabled, localSessionMaxAge, loginWithPassword, makeLocalSession, resetStaffPassword, setStaffActive, deleteStaffAccount,
  listStaffRoles, createStaffRole, updateStaffRole } from "./localAccounts";
import {
  createEnrollment,
  createIncident,
  createInventoryItem,
  createInventoryProduct,
  addInventoryVariantUnits,
  addInventoryVariant,
  cancelSale,
  createSale,
  createStudent,
  createStudentWithEnrollment,
  updateStudent,
  createInventoryCategory,
  deleteInventoryCategory,
  deleteInventoryProduct,
  getSchoolProfile,
  getDashboardStats,
  listEnrollments,
  listIncidents,
  listIncidentsByStudent,
  listInventory,
  listInventoryMovements,
  listSales,
  listSalesByStudent,
  listStudents,
  listInventoryCategories,
  recordInventoryMovement,
  recordInventoryMovements,
  resolveIncident,
  saveSchoolProfile,
  updateInventoryVariantPrice,
  updateInventoryMinimum,
} from "./db";
import { digitsOnly, isValidCpf, normalizeBrazilianPhone } from "./studentValidation";
import { actionLabels, listAuditEvents, listBackupRuns, safeRecordAction, safeTargetId } from "./audit";
import { permissionKeys, type PermissionKey } from "../shared/permissions";
import { inventoryCategoryIconKeys } from "../shared/inventory";
import { createMercadoPagoPix, getMercadoPagoPayment } from "./mercadoPago";
import {
  GUARDIAN_COOKIE_NAME,
  createGuardianAccount,
  createGuardianMessage,
  guardianCookieOptions,
  guardianSessionMaxAge,
  listGuardianAccounts,
  listGuardianMessages,
  listGuardianNotifications,
  listGuardianStudents,
  listSchoolMessages,
  loginGuardian,
  makeGuardianSession,
  markGuardianNotificationRead,
  sendGuardianAnnouncement,
} from "./guardianAccounts";

const cpfInput = z.string().transform(digitsOnly).refine(isValidCpf, "Informe um CPF válido com 11 dígitos.");
const phoneInput = z.string().transform(normalizeBrazilianPhone).refine(value => /^[1-9]\d[2-9]\d{7,8}$/.test(value), "Informe um telefone com DDD válido.");
const studentInput = z.object({
  name: z.string().trim().min(2).max(160),
  grade: z.string().trim().min(1).max(80),
  guardianName: z.string().trim().min(2).max(160),
  cpf: cpfInput,
  guardianCpf: cpfInput,
  address: z.string().trim().min(8).max(500),
  guardianEmail: z.email().max(320),
  phones: z.array(phoneInput).min(1).max(20).refine(values => new Set(values).size === values.length, "Não repita telefones."),
  birthDate: z.string().optional(),
});
const studentWithEnrollmentInput = studentInput.extend({
  schoolYear: z.string().trim().min(4).max(9),
  className: z.string().trim().min(1).max(80),
  shift: z.enum(["morning", "afternoon", "fulltime"]),
});

const auditedProcedure = protectedProcedure.use(async ({ ctx, path, getRawInput, next }) => {
  const result = await next();
  if (result.ok && actionLabels[path]) {
    await safeRecordAction(ctx.user, ctx.localRole, path, safeTargetId(await getRawInput(), result.data));
  }
  return result;
});

const ownerProcedure = auditedProcedure.use(({ ctx, next }) => {
  if (!localModeEnabled() || ctx.localRole !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o dono pode gerenciar os acessos." });
  return next({ ctx });
});

const permissionProcedure = (permission: PermissionKey) => auditedProcedure.use(({ ctx, next }) => {
  if (!localModeEnabled() || ctx.localRole === "owner" || ctx.localPermissions?.includes(permission)) return next({ ctx });
  throw new TRPCError({ code: "FORBIDDEN", message: "Sua função não tem permissão para acessar este módulo." });
});
const guardianProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.guardian) throw new TRPCError({ code: "UNAUTHORIZED", message: "Faça login como responsável para continuar." });
  return next({ ctx: { ...ctx, guardian: ctx.guardian } });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? { ...ctx.user, localRole: ctx.localRole ?? null, localPermissions: ctx.localPermissions ?? [] } : null),
    provider: publicProcedure.query(() => localAuthStatus()),
    guardianMe: publicProcedure.query(({ ctx }) => ctx.guardian ? { email: ctx.guardian.email, fullName: ctx.guardian.fullName, studentIds: ctx.guardian.studentIds } : null),
    login: publicProcedure.input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const { account, user } = await loginWithPassword(input.username, input.password, ctx.req.socket?.remoteAddress ?? "unknown");
        const token = await makeLocalSession(account);
        ctx.res.cookie(LOCAL_COOKIE_NAME, token, { ...localCookieOptions(ctx.req), maxAge: localSessionMaxAge });
        await safeRecordAction(user, account.role, "auth.login");
        return { success: true } as const;
      }),
    changePassword: auditedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }))
      .mutation(async ({ ctx, input }) => {
        if (!localModeEnabled()) throw new TRPCError({ code: "FORBIDDEN" });
        await changeOwnPassword(ctx.user.id, input.currentPassword, input.newPassword);
        ctx.res.clearCookie(LOCAL_COOKIE_NAME, localCookieOptions(ctx.req));
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await safeRecordAction(ctx.user, ctx.localRole, "auth.logout");
      ctx.res.clearCookie(LOCAL_COOKIE_NAME, { ...localCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
    guardianLogin: publicProcedure.input(z.object({ email: z.email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const { account, studentIds } = await loginGuardian(input.email, input.password, ctx.req.socket?.remoteAddress ?? "unknown");
        const token = await makeGuardianSession(account);
        ctx.res.cookie(GUARDIAN_COOKIE_NAME, token, { ...guardianCookieOptions(ctx.req), maxAge: guardianSessionMaxAge });
        return { success: true, fullName: account.fullName, studentIds } as const;
      }),
    guardianLogout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(GUARDIAN_COOKIE_NAME, { ...guardianCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  staff: router({
    list: ownerProcedure.query(() => listStaff()),
    roles: ownerProcedure.query(() => listStaffRoles()),
    createRole: ownerProcedure.input(z.object({ name: z.string().trim().min(2).max(80), permissions: z.array(z.enum(permissionKeys)) })).mutation(({ input }) => createStaffRole(input)),
    updateRole: ownerProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(80), permissions: z.array(z.enum(permissionKeys)) })).mutation(({ input }) => updateStaffRole(input)),
    create: ownerProcedure.input(z.object({ firstName: z.string().min(2).max(80), cpfFirstFour: z.string().regex(/^\d{4}$/), fullName: z.string().min(2).max(160), roleId: z.number().int().positive(), password: z.string().min(8).max(128) }))
      .mutation(({ input }) => addStaff(input)),
    setActive: ownerProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
      .mutation(({ input }) => setStaffActive(input.id, input.active)),
    delete: ownerProcedure.input(z.object({ targetId: z.number().int().positive() }))
      .mutation(({ input }) => deleteStaffAccount(input.targetId)),
    resetPassword: ownerProcedure.input(z.object({ targetId: z.number().int().positive(), ownerPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }))
      .mutation(({ ctx, input }) => resetStaffPassword({ ...input, ownerUserId: ctx.user.id })),
  }),
  audit: router({
    list: ownerProcedure.input(z.object({ staffAccountId: z.number().int().positive().optional(), beforeId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(({ input }) => listAuditEvents(input ?? {})),
    backups: ownerProcedure.query(() => listBackupRuns()),
  }),
  school: router({
    dashboard: permissionProcedure("dashboard").query(() => getDashboardStats()),
    profile: protectedProcedure.query(() => getSchoolProfile()),
    guardianAccounts: permissionProcedure("communications").query(() => listGuardianAccounts()),
    createGuardianAccount: permissionProcedure("communications").input(z.object({ studentId: z.number().int().positive(), email: z.email().max(320), fullName: z.string().trim().min(2).max(160), password: z.string().min(8).max(128) })).mutation(({ input }) => createGuardianAccount(input)),
    schoolMessages: permissionProcedure("communications").query(() => listSchoolMessages()),
    sendGuardianAnnouncement: permissionProcedure("communications").input(z.object({ guardianId: z.number().int().positive(), studentId: z.number().int().positive().optional(), subject: z.string().trim().min(2).max(160), body: z.string().trim().min(2).max(5000) })).mutation(({ input }) => sendGuardianAnnouncement(input)),
    updateProfile: ownerProcedure.input(z.object({
      name: z.string().trim().min(2).max(160),
      cnpj: z.string().trim().max(18).transform(value => value.replace(/\D/g, "")).refine(value => !value || value.length === 14, "Informe um CNPJ com 14 dígitos.").optional(),
      address: z.string().trim().max(500).optional(),
      phone: z.string().trim().max(40).transform(value => value.replace(/\D/g, "")).refine(value => !value || value.length <= 20, "O telefone deve ter no máximo 20 dígitos.").optional(),
      email: z.string().trim().email().max(320).optional(),
    })).mutation(({ input }) => saveSchoolProfile(input)),
    students: permissionProcedure("students").query(() => listStudents()),
    addStudent: permissionProcedure("students").input(studentInput).mutation(({ input }) => createStudent(input)),
    addStudentWithEnrollment: permissionProcedure("students").input(studentWithEnrollmentInput).mutation(({ input }) => createStudentWithEnrollment(input)),
    updateStudent: permissionProcedure("students").input(studentInput.extend({ id: z.number().int().positive(), className: z.string().trim().min(1).max(80).optional() })).mutation(({ input }) => updateStudent(input)),
    enrollments: permissionProcedure("students").query(() => listEnrollments()),
    addEnrollment: permissionProcedure("students")
      .input(z.object({ studentId: z.number().int().positive(), schoolYear: z.string().min(4), className: z.string().min(1), shift: z.enum(["morning", "afternoon", "fulltime"]) }))
      .mutation(({ input }) => createEnrollment(input)),
    inventory: permissionProcedure("inventory").query(() => listInventory()),
    inventoryCategories: permissionProcedure("inventory").query(() => listInventoryCategories()),
    createInventoryCategory: ownerProcedure.input(z.object({ name: z.string().trim().min(2).max(80), icon: z.enum(inventoryCategoryIconKeys).default("package") })).mutation(({ input }) => createInventoryCategory(input.name, input.icon)),
    deleteInventoryCategory: ownerProcedure.input(z.object({ categoryId: z.number().int().positive() })).mutation(({ input }) => deleteInventoryCategory(input.categoryId)),
    updateInventoryMinimum: permissionProcedure("inventory").input(z.object({ itemId: z.number().int().positive(), minQuantity: z.number().int().min(0).max(100000) })).mutation(({ input }) => updateInventoryMinimum(input.itemId, input.minQuantity)),
    deleteInventoryProduct: permissionProcedure("inventory").input(z.object({ itemId: z.number().int().positive() })).mutation(({ input }) => deleteInventoryProduct(input.itemId)),
    inventoryHistory: permissionProcedure("inventory").query(() => listInventoryMovements()),
    sales: permissionProcedure("sales").query(() => listSales()),
    salesByStudent: permissionProcedure("sales").input(z.object({ studentId: z.number().int().positive() })).query(({ input }) => listSalesByStudent(input.studentId)),
    addInventoryProduct: permissionProcedure("inventory")
      .input(z.object({ name: z.string().min(2), category: z.string().trim().min(2).max(80), minQuantity: z.number().int().min(0).max(100000), variants: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) })).min(1).max(10) }))
      .mutation(({ input }) => createInventoryProduct(input)),
    addInventoryVariantUnits: permissionProcedure("inventory")
      .input(z.object({ reason: z.string().optional(), items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => addInventoryVariantUnits(input)),
    addInventoryVariant: permissionProcedure("inventory")
      .input(z.object({ itemId: z.number().int().positive(), name: z.string().min(1), quantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => addInventoryVariant(input)),
    updateInventoryVariantPrice: permissionProcedure("inventory")
      .input(z.object({ variantId: z.number().int().positive(), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => updateInventoryVariantPrice(input)),
    addInventoryItem: permissionProcedure("inventory")
      .input(z.object({ name: z.string().min(2), category: z.enum(["uniform", "book", "other"]), size: z.string().optional(), quantity: z.number().int().min(0), minQuantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => createInventoryItem(input)),
    inventoryMovement: permissionProcedure("inventory")
      .input(z.object({ itemId: z.number().int().positive(), type: z.enum(["entry", "exit"]), quantity: z.number().int().positive(), reason: z.string().optional() }))
      .mutation(({ input }) => recordInventoryMovement(input)),
    inventoryBulkMovement: permissionProcedure("inventory")
      .input(z.object({ type: z.enum(["entry", "exit"]), reason: z.string().optional(), items: z.array(z.object({ itemId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => recordInventoryMovements(input)),
    createSale: permissionProcedure("sales")
      .input(z.object({ enrollmentId: z.number().int().positive().optional(), discountType: z.enum(["fixed", "percentage"]).optional(), discountValue: z.number().min(0).optional(), paymentMethod: z.enum(["cash", "pix", "card", "other"]).optional(), items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => createSale(input)),
    cancelSale: permissionProcedure("sales")
      .input(z.object({ saleId: z.number().int().positive() }))
      .mutation(({ input }) => cancelSale(input.saleId)),
    createMercadoPagoPix: permissionProcedure("sales")
      .input(z.object({ amountCents: z.number().int().positive().max(100000000), description: z.string().trim().min(3).max(120), payerEmail: z.email().optional() }))
      .mutation(({ input }) => createMercadoPagoPix(input)),
    getMercadoPagoPayment: permissionProcedure("sales")
      .input(z.object({ paymentId: z.string().regex(/^\d+$/).max(40) }))
      .query(({ input }) => getMercadoPagoPayment(input.paymentId)),
    incidents: permissionProcedure("incidents").query(() => listIncidents()),
    incidentsByStudent: permissionProcedure("incidents").input(z.object({ studentId: z.number().int().positive() })).query(({ input }) => listIncidentsByStudent(input.studentId)),
    addIncident: permissionProcedure("incidents")
      .input(z.object({ studentId: z.number().int().positive(), type: z.enum(["absence", "late", "homework", "book", "uniform", "behavior", "other"]), note: z.string().trim().max(2000).optional().transform(value => value ?? ""), occurredAt: z.date().optional() }))
      .mutation(({ input }) => createIncident(input)),
    resolveIncident: permissionProcedure("incidents").input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => resolveIncident(input.id)),
  }),
  family: router({
    students: guardianProcedure.query(({ ctx }) => listGuardianStudents(ctx.guardian.guardianId)),
    notifications: guardianProcedure.query(({ ctx }) => listGuardianNotifications(ctx.guardian.guardianId)),
    messages: guardianProcedure.query(({ ctx }) => listGuardianMessages(ctx.guardian.guardianId)),
    markNotificationRead: guardianProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markGuardianNotificationRead(input.id, ctx.guardian.guardianId)),
    sendMessage: guardianProcedure.input(z.object({ studentId: z.number().int().positive(), subject: z.string().trim().min(2).max(160), body: z.string().trim().min(2).max(5000) })).mutation(({ ctx, input }) => createGuardianMessage({ ...input, guardianId: ctx.guardian.guardianId })),
  }),
});

export type AppRouter = typeof appRouter;
