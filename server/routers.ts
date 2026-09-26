import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createEnrollment,
  createIncident,
  createInventoryItem,
  createInventoryProduct,
  addInventoryVariantUnits,
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
} from "./db";

const studentInput = z.object({
  name: z.string().min(2),
  grade: z.string().min(1),
  guardianName: z.string().min(2),
  guardianPhone: z.string().optional(),
  birthDate: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
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
      .input(z.object({ items: z.array(z.object({ itemId: z.number().int().positive(), variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) }))
      .mutation(({ input }) => createSale(input)),
    incidents: protectedProcedure.query(() => listIncidents()),
    addIncident: protectedProcedure
      .input(z.object({ studentId: z.number().int().positive(), type: z.enum(["absence", "late", "homework", "book", "uniform", "behavior", "other"]), note: z.string().min(3) }))
      .mutation(({ input }) => createIncident(input)),
    resolveIncident: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => resolveIncident(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
