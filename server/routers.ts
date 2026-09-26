import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { googleAuthStatus, googleSessionCookieOptions } from "./googleAuth";
import { LOCAL_COOKIE_NAME, addStaff, changeOwnPassword, listStaff, localAuthStatus, localCookieOptions,
  localModeEnabled, localSessionMaxAge, loginWithPassword, makeLocalSession, resetStaffPassword, setStaffActive } from "./localAccounts";
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
  getSchoolProfile,
  getDashboardStats,
  listEnrollments,
  listIncidents,
  listInventory,
  listInventoryMovements,
  listSales,
  listStudents,
  recordInventoryMovement,
  recordInventoryMovements,
  resolveIncident,
  saveSchoolProfile,
  updateInventoryVariantPrice,
} from "./db";
import { digitsOnly, isValidCpf, normalizeBrazilianPhone } from "./studentValidation";
import { actionLabels, listAuditEvents, listBackupRuns, safeRecordAction, safeTargetId } from "./audit";

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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? { ...ctx.user, localRole: ctx.localRole ?? null } : null),
    provider: publicProcedure.query(() => localModeEnabled() ? localAuthStatus() : googleAuthStatus()),
    login: publicProcedure.input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const { account, user } = await loginWithPassword(input.username, input.password, ctx.req.socket?.remoteAddress ?? "unknown");
        const token = await makeLocalSession(account);
        ctx.res.cookie(LOCAL_COOKIE_NAME, token, { ...localCookieOptions(ctx.req), maxAge: localSessionMaxAge });
        await safeRecordAction(user, account.role, "auth.login");
        return { success: true } as const;
      }),
    changePassword: auditedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(15).max(128) }))
      .mutation(async ({ ctx, input }) => {
        if (!localModeEnabled()) throw new TRPCError({ code: "FORBIDDEN" });
        await changeOwnPassword(ctx.user.id, input.currentPassword, input.newPassword);
        ctx.res.clearCookie(LOCAL_COOKIE_NAME, localCookieOptions(ctx.req));
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (localModeEnabled()) {
        await safeRecordAction(ctx.user, ctx.localRole, "auth.logout");
        ctx.res.clearCookie(LOCAL_COOKIE_NAME, localCookieOptions(ctx.req));
        return { success: true } as const;
      }
      const cookieOptions = googleAuthStatus().mode === "google" ? googleSessionCookieOptions(ctx.req) : getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  staff: router({
    list: ownerProcedure.query(() => listStaff()),
    create: ownerProcedure.input(z.object({ firstName: z.string().min(2).max(80), cpfFirstFour: z.string().regex(/^\d{4}$/), fullName: z.string().min(2).max(160), jobTitle: z.string().min(2).max(120), password: z.string().min(15).max(128) }))
      .mutation(({ input }) => addStaff(input)),
    setActive: ownerProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
      .mutation(({ input }) => setStaffActive(input.id, input.active)),
    resetPassword: ownerProcedure.input(z.object({ targetId: z.number().int().positive(), ownerPassword: z.string().min(1).max(128), newPassword: z.string().min(15).max(128) }))
      .mutation(({ ctx, input }) => resetStaffPassword({ ...input, ownerUserId: ctx.user.id })),
  }),
  audit: router({
    list: ownerProcedure.input(z.object({ staffAccountId: z.number().int().positive().optional(), beforeId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(({ input }) => listAuditEvents(input ?? {})),
    backups: ownerProcedure.query(() => listBackupRuns()),
  }),
  school: router({
    dashboard: protectedProcedure.query(() => getDashboardStats()),
    profile: protectedProcedure.query(() => getSchoolProfile()),
    updateProfile: ownerProcedure.input(z.object({
      name: z.string().trim().min(2).max(160),
      cnpj: z.string().trim().max(18).transform(value => value.replace(/\D/g, "")).refine(value => !value || value.length === 14, "Informe um CNPJ com 14 dígitos.").optional(),
      address: z.string().trim().max(500).optional(),
      phone: z.string().trim().max(40).transform(value => value.replace(/\D/g, "")).refine(value => !value || value.length <= 20, "O telefone deve ter no máximo 20 dígitos.").optional(),
      email: z.string().trim().email().max(320).optional(),
    })).mutation(({ input }) => saveSchoolProfile(input)),
    students: protectedProcedure.query(() => listStudents()),
    addStudent: auditedProcedure.input(studentInput).mutation(({ input }) => createStudent(input)),
    enrollments: protectedProcedure.query(() => listEnrollments()),
    addEnrollment: auditedProcedure
      .input(z.object({ studentId: z.number().int().positive(), schoolYear: z.string().min(4), className: z.string().min(1), shift: z.enum(["morning", "afternoon", "fulltime"]) }))
      .mutation(({ input }) => createEnrollment(input)),
    inventory: protectedProcedure.query(() => listInventory()),
    inventoryHistory: protectedProcedure.query(() => listInventoryMovements()),
    sales: protectedProcedure.query(() => listSales()),
    addInventoryProduct: auditedProcedure
      .input(z.object({ name: z.string().min(2), category: z.enum(["uniform", "book", "other"]), variants: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) })).min(1).max(10) }))
      .mutation(({ input }) => createInventoryProduct(input)),
    addInventoryVariantUnits: auditedProcedure
      .input(z.object({ reason: z.string().optional(), items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => addInventoryVariantUnits(input)),
    addInventoryVariant: auditedProcedure
      .input(z.object({ itemId: z.number().int().positive(), name: z.string().min(1), quantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => addInventoryVariant(input)),
    updateInventoryVariantPrice: auditedProcedure
      .input(z.object({ variantId: z.number().int().positive(), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => updateInventoryVariantPrice(input)),
    addInventoryItem: auditedProcedure
      .input(z.object({ name: z.string().min(2), category: z.enum(["uniform", "book", "other"]), size: z.string().optional(), quantity: z.number().int().min(0), minQuantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => createInventoryItem(input)),
    inventoryMovement: auditedProcedure
      .input(z.object({ itemId: z.number().int().positive(), type: z.enum(["entry", "exit"]), quantity: z.number().int().positive(), reason: z.string().optional() }))
      .mutation(({ input }) => recordInventoryMovement(input)),
    inventoryBulkMovement: auditedProcedure
      .input(z.object({ type: z.enum(["entry", "exit"]), reason: z.string().optional(), items: z.array(z.object({ itemId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => recordInventoryMovements(input)),
    createSale: auditedProcedure
      .input(z.object({ enrollmentId: z.number().int().positive().optional(), discountType: z.enum(["fixed", "percentage"]).optional(), discountValue: z.number().min(0).optional(), paymentMethod: z.enum(["cash", "pix", "card", "other"]).optional(), items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => createSale(input)),
    cancelSale: auditedProcedure
      .input(z.object({ saleId: z.number().int().positive() }))
      .mutation(({ input }) => cancelSale(input.saleId)),
    incidents: protectedProcedure.query(() => listIncidents()),
    addIncident: auditedProcedure
      .input(z.object({ studentId: z.number().int().positive(), type: z.enum(["absence", "late", "homework", "book", "uniform", "behavior", "other"]), note: z.string().min(3) }))
      .mutation(({ input }) => createIncident(input)),
    resolveIncident: auditedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => resolveIncident(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
