// Nav identity + stats for the signed-in shell, resolved server-side in the root
// loader. Safe to SSR because the Worker bypasses the edge cache whenever a
// better-auth cookie is present (workers/app.ts), so a signed-in response is never
// written into the anonymous cache. Reads run in-process via core (the standing
// rule: loaders never self-fetch the Worker's own /api/v1).
import { createDb, libraryRepo, profilesRepo } from "@foxing/core";
import { getAuth } from "./auth.server";

export interface NavUser {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stats: {
    booksThisYear: number;
    dayStreak: number;
    highlights: number;
  };
}

/** The signed-in nav identity, or null for anonymous / not-yet-onboarded users.
 *  A signed-in user with no profile row still sees the signed-out nav here; the
 *  profile-gated page loaders are what route them to /onboarding. */
export async function getNavUser(env: Env, request: Request): Promise<NavUser | null> {
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) return null;

  const db = createDb(env.DB);
  const profile = await profilesRepo.getProfileById(db, session.user.id);
  if (!profile) return null;

  const year = new Date().getUTCFullYear();
  const [streak, booksThisYear] = await Promise.all([
    libraryRepo.getStreak(db, session.user.id),
    libraryRepo.countFinishedInPeriod(db, session.user.id, { periodType: "year", year }),
  ]);

  return {
    username: profile.username,
    displayName: profile.displayName ?? profile.username,
    avatarUrl: profile.avatarUrl,
    stats: {
      booksThisYear,
      dayStreak: streak?.currentStreak ?? 0,
      highlights: streak?.totalHighlights ?? 0,
    },
  };
}
