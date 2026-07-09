// Profile gate for authenticated routes. A signed-in user with no profile row has
// not finished onboarding (accounts created before onboarding existed, or a reset
// mid-signup), so every profile-dependent loader must send them to /onboarding.
// Reads the profile in-process via core, per the standing rule: loaders never
// self-fetch the Worker's own /api/v1 (that loopback returns a 404 HTML page, not
// JSON, unconditionally, which is what crashed /me before this gate existed).
import type { Profile } from "@foxing/core";
import { createDb, profilesRepo } from "@foxing/core";
import { redirect } from "react-router";
import { getAuth } from "./auth.server";

export interface SessionUser {
  id: string;
  email: string;
}

export interface ProfileContext {
  user: SessionUser;
  profile: Profile;
}

// Resolve the profile for a known user id, or redirect to onboarding when absent.
// Split from session resolution so it can be tested against D1 without Better Auth.
export async function requireProfileForUser(env: Env, user: SessionUser): Promise<ProfileContext> {
  const profile = await profilesRepo.getProfileById(createDb(env.DB), user.id);
  if (!profile) throw redirect("/onboarding");
  return { user, profile };
}

// Full gate for a loader: unauthenticated to /login, onboarded-less to /onboarding.
export async function requireProfile(env: Env, request: Request): Promise<ProfileContext> {
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login");
  return requireProfileForUser(env, { id: session.user.id, email: session.user.email });
}
