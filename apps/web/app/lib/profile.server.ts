// Profile gate for authenticated routes: a signed-in user with no profile row has not finished onboarding, so profile-dependent loaders send them to /onboarding. Loaders never self-fetch /api/v1: that loopback returns a 404 HTML page.
import type { SignedInProfile } from "@foxing/core";
import { isAdminEmail } from "@dustinedwards/site-runtime/access";
import { createDb, profilesRepo } from "@foxing/core";
import { redirect } from "react-router";
import { sessionUserFromRequest } from "./auth.server";
import { signInFrom } from "./sign-in-path";

export interface SessionUser {
  id: string;
  email: string;
}

export interface ProfileContext {
  user: SessionUser;
  profile: SignedInProfile;
}

export async function requireProfileForUser(env: Env, user: SessionUser): Promise<ProfileContext> {
  const row = await profilesRepo.getProfileById(createDb(env.DB), user.id);
  if (!row) throw redirect("/onboarding");
  // Admin is the ADMIN_EMAIL and CO_OWNER_EMAILS setting (site-runtime isAdminEmail), never the stored row.
  const profile = { ...row, isAdmin: isAdminEmail(env, user.email) };
  return { user, profile };
}

export async function requireProfile(env: Env, request: Request): Promise<ProfileContext> {
  const user = await sessionUserFromRequest(request, env);
  if (!user) throw redirect(signInFrom(request));
  return requireProfileForUser(env, user);
}
