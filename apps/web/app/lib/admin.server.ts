// Admin gate for /admin/* loaders: requireProfile, then the admin list and Cloudflare Access. A non-admin goes to /home; anonymous and un-onboarded users are handled upstream.
import { adminRepo, createDb } from "@foxing/core";
import { redirect, type RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/context";
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import { type ProfileContext, requireProfile } from "./profile.server";

export async function requireAdmin(env: Env, request: Request): Promise<ProfileContext> {
  const ctx = await requireProfile(env, request);
  if (!ctx.profile.isAdmin) throw redirect("/home");
  // Access must have signed this request for the admin's own email, so an Access session never stands in for another account.
  if (!(await accessAdmin(request, env, { admins: [ctx.user.email] }))) {
    throw new Response("Sign in through Cloudflare Access.", { status: 403 });
  }
  return ctx;
}

/** The admin gate plus the plain D1 handle every /admin loader reads with. */
export async function adminLoaderBase(context: Readonly<RouterContextProvider>, request: Request) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  return { env, db: createDb(env.DB) };
}

/** The headline counts and the newest audit rows, shared by the admin overview and analytics. */
export async function adminOverview(db: ReturnType<typeof createDb>, auditLimit: number) {
  const [stats, audit] = await Promise.all([
    adminRepo.getAdminStats(db),
    adminRepo.listAuditLog(db, auditLimit),
  ]);
  return { stats, audit };
}
