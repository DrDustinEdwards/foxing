import { adminRepo } from "@foxing/core";
import type { Context } from "hono";
import { errors } from "../error";
import { requireSession } from "../http";
import type { Env, SessionUser } from "../types";

// Session + admin list gate; also keeps a suspended admin out of the reads (profileMw blocks their writes).
export function requireAdmin(c: Context<Env>): SessionUser {
  const session = requireSession(c);
  const profile = c.get("profile");
  if (!profile?.isAdmin) throw errors.forbidden("Admin only.");
  if (profile.isSuspended) throw errors.forbidden("Account suspended.");
  return session;
}

// Record every admin write, after the mutation commits, so the log shows applied changes only.
export async function audit(c: Context<Env>, action: string, params: Record<string, unknown>) {
  await adminRepo.writeAuditLog(c.get("db"), {
    action,
    params: c.get("viaOperator") ? { ...params, via: "operator" } : params,
    actor: c.get("session")?.id ?? null,
    sourceIp: c.req.header("CF-Connecting-IP") ?? null,
  });
}
