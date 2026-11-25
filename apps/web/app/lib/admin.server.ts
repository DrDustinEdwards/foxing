// Admin gate for /admin/* loaders: requireProfile, then the admin list and Cloudflare Access. A non-admin goes to /home; anonymous and un-onboarded users are handled upstream.
import { redirect } from "react-router";
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
