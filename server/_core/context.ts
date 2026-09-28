import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateLocalRequest, localModeEnabled, type LocalRole } from "../localAccounts";
import type { PermissionKey } from "../../shared/permissions";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  localRole?: LocalRole | null;
  localPermissions?: PermissionKey[];
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let localRole: LocalRole | null = null;
  let localPermissions: PermissionKey[] = [];
  try {
    if (localModeEnabled()) {
      const local = await authenticateLocalRequest(opts.req);
      user = local;
      localRole = local?.localRole ?? null;
      localPermissions = local?.localPermissions ?? [];
    }
  } catch {
    // Authentication is optional for public procedures; fail closed on errors.
    user = null;
  }
  return { req: opts.req, res: opts.res, user, localRole, localPermissions };
}
