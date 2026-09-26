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
  updateInventoryVariantPrice,
} from "./db";

const studentInput = z.object({
  name: z.string().min(2),
  grade: z.string().min(1),
  guardianName: z.string().min(2),
  guardianPhone: z.string().optional(),
  birthDate: z.string().optional(),
});

const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
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
        const { account } = await loginWithPassword(input.username, input.password, ctx.req.socket?.remoteAddress ?? "unknown");
        const token = await makeLocalSession(account);
        ctx.res.cookie(LOCAL_COOKIE_NAME, token, { ...localCookieOptions(ctx.req), maxAge: localSessionMaxAge });
        return { success: true } as const;
      }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(15).max(128) }))
      .mutation(async ({ ctx, input }) => {
        if (!localModeEnabled()) throw new TRPCError({ code: "FORBIDDEN" });
        await changeOwnPassword(ctx.user.id, input.currentPassword, input.newPassword);
        ctx.res.clearCookie(LOCAL_COOKIE_NAME, localCookieOptions(ctx.req));
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      if (localModeEnabled()) {
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
  school: router({
    dashboard: protectedProcedure.query(() => getDashboardStats()),
    students: protectedProcedure.query(() => listStudents()),
    addStudent: protectedProcedure.input(studentInput).mutation(({ input }) => createStudent(input)),
    enrollments: protectedProcedure.query(() => listEnrollments()),
    addEnrollment: protectedProcedure
      .input(z.object({ studentId: z.number().int().positive(), schoolYear: z.string().min(4), className: z.string().min(1), shift: z.enum(["morning", "afternoon", "fulltime"]) }))
      .mutation(({ input }) => createEnrollment(input)),
    inventory: protectedProcedure.query(() => listInventory()),
    inventoryHistory: protectedProcedure.query(() => listInventoryMovements()),
    sales: protectedProcedure.query(() => listSales()),
    addInventoryProduct: protectedProcedure
      .input(z.object({ name: z.string().min(2), category: z.enum(["uniform", "book", "other"]), variants: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) })).min(1).max(10) }))
      .mutation(({ input }) => createInventoryProduct(input)),
    addInventoryVariantUnits: protectedProcedure
      .input(z.object({ reason: z.string().optional(), items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => addInventoryVariantUnits(input)),
    addInventoryVariant: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive(), name: z.string().min(1), quantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => addInventoryVariant(input)),
    updateInventoryVariantPrice: protectedProcedure
      .input(z.object({ variantId: z.number().int().positive(), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => updateInventoryVariantPrice(input)),
    addInventoryItem: protectedProcedure
      .input(z.object({ name: z.string().min(2), category: z.enum(["uniform", "book", "other"]), size: z.string().optional(), quantity: z.number().int().min(0), minQuantity: z.number().int().min(0), unitPriceCents: z.number().int().min(0) }))
      .mutation(({ input }) => createInventoryItem(input)),
    inventoryMovement: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive(), type: z.enum(["entry", "exit"]), quantity: z.number().int().positive(), reason: z.string().optional() }))
      .mutation(({ input }) => recordInventoryMovement(input)),
    inventoryBulkMovement: protectedProcedure
      .input(z.object({ type: z.enum(["entry", "exit"]), reason: z.string().optional(), items: z.array(z.object({ itemId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => recordInventoryMovements(input)),
    createSale: protectedProcedure
      .input(z.object({ discountType: z.enum(["fixed", "percentage"]).optional(), discountValue: z.number().min(0).optional(), paymentMethod: z.enum(["cash", "pix", "card", "other"]).optional(), items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => createSale(input)),
    cancelSale: protectedProcedure
      .input(z.object({ saleId: z.number().int().positive() }))
      .mutation(({ input }) => cancelSale(input.saleId)),
    incidents: protectedProcedure.query(() => listIncidents()),
    addIncident: protectedProcedure
      .input(z.object({ studentId: z.number().int().positive(), type: z.enum(["absence", "late", "homework", "book", "uniform", "behavior", "other"]), note: z.string().min(3) }))
      .mutation(({ input }) => createIncident(input)),
    resolveIncident: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => resolveIncident(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
