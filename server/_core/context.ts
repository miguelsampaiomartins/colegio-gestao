import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateLocalRequest, localModeEnabled, type LocalRole } from "../localAccounts";
import type { PermissionKey } from "../../shared/permissions";
import { authenticateGuardianRequest, type GuardianSession } from "../guardianAccounts";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  localRole?: LocalRole | null;
  localPermissions?: PermissionKey[];
  guardian: GuardianSession | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let localRole: LocalRole | null = null;
  let localPermissions: PermissionKey[] = [];
  let guardian: GuardianSession | null = null;
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
  try { guardian = await authenticateGuardianRequest(opts.req); } catch { guardian = null; }
  return { req: opts.req, res: opts.res, user, localRole, localPermissions, guardian };
}
