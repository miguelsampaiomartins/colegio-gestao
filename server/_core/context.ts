import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateGoogleRequest, googleModeEnabled } from "../googleAuth";
import { authenticateLocalRequest, localModeEnabled, type LocalRole } from "../localAccounts";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  localRole?: LocalRole | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let localRole: LocalRole | null = null;
  try {
    if (localModeEnabled()) {
      const local = await authenticateLocalRequest(opts.req);
      user = local;
      localRole = local?.localRole ?? null;
    } else {
      user = googleModeEnabled() ? await authenticateGoogleRequest(opts.req) : await sdk.authenticateRequest(opts.req);
    }
  } catch {
    // Authentication is optional for public procedures; fail closed on errors.
    user = null;
  }
  return { req: opts.req, res: opts.res, user, localRole };
}
