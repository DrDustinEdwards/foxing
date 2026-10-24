// Admin gate for the /admin/* loaders. Builds on requireProfile, then enforces
// profiles.is_admin and Cloudflare Access (access.server.ts). A signed-in non-admin is
// sent to /home (the admin surface is not secret, just operator-only); an admin whose
// request Access did not sign for them is refused; anonymous and un-onboarded users are
// handled upstream by requireProfile (to /login, /onboarding). Reads inside admin loaders run in-process via
// adminRepo, per the standing rule that loaders never self-fetch the Worker's own API.
import { redirect } from "react-router";
import { adminAccessOk } from "./access.server";
import { type ProfileContext, requireProfile } from "./profile.server";

export async function requireAdmin(env: Env, request: Request): Promise<ProfileContext> {
  const ctx = await requireProfile(env, request);
  if (!ctx.profile.isAdmin) throw redirect("/home");
  if (!(await adminAccessOk(env, request, ctx.user.email))) {
    throw new Response("Sign in through Cloudflare Access.", { status: 403 });
  }
  return ctx;
}
