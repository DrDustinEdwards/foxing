// Admin gate for the /admin/* loaders. Builds on requireProfile, then enforces
// profiles.is_admin and Cloudflare Access (site-runtime ./access). A signed-in non-admin is
// sent to /home (the admin surface is not secret, just operator-only); an admin whose
// request Access did not sign for them is refused; anonymous and un-onboarded users are
// handled upstream by requireProfile (to /login, /onboarding). Reads inside admin loaders run in-process via
// adminRepo, per the standing rule that loaders never self-fetch the Worker's own API.
import { redirect } from "react-router";
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import { type ProfileContext, requireProfile } from "./profile.server";

export async function requireAdmin(env: Env, request: Request): Promise<ProfileContext> {
  const ctx = await requireProfile(env, request);
  if (!ctx.profile.isAdmin) throw redirect("/home");
  // Access must have signed this request for the signed-in admin's own email, so an Access
  // session never stands in for another account. Unset ACCESS_* settings: refused.
  if (!(await accessAdmin(request, env, { admins: [ctx.user.email] }))) {
    throw new Response("Sign in through Cloudflare Access.", { status: 403 });
  }
  return ctx;
}
