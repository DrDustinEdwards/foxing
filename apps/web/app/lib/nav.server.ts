// Nav identity + stats for the signed-in shell, resolved server-side in the root
// loader. Safe to SSR because the Worker bypasses the edge cache whenever a
// better-auth cookie is present (workers/app.ts), so a signed-in response is never
// written into the anonymous cache. Reads run in-process via core (the standing
// rule: loaders never self-fetch the Worker's own /api/v1).
import { catalogRepo, createDb, libraryRepo, profilesRepo } from "@foxing/core";
import { getAuth } from "./auth.server";

export interface NavUser {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  subscriptionTier: "free" | "plus";
  isAdmin: boolean;
  stats: {
    booksThisYear: number;
    dayStreak: number;
    highlights: number;
  };
  vocabularyToMaster: number;
}

/** The signed-in nav identity, or null for anonymous / not-yet-onboarded users.
 *  A signed-in user with no profile row still sees the signed-out nav here; the
 *  profile-gated page loaders are what route them to /onboarding. */
export async function getNavUser(env: Env, request: Request): Promise<NavUser | null> {
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  if (!session?.user) return null;

  const db = createDb(env.DB);
  const profile = await profilesRepo.getProfileById(db, session.user.id);
  if (!profile) return null;

  const year = new Date().getUTCFullYear();
  const [streak, booksThisYear, vocabularyToMaster] = await Promise.all([
    libraryRepo.getStreak(db, session.user.id),
    libraryRepo.countFinishedInPeriod(db, session.user.id, { periodType: "year", year }),
    libraryRepo.countVocabularyToMaster(db, session.user.id),
  ]);

  return {
    username: profile.username,
    displayName: profile.displayName ?? profile.username,
    avatarUrl: profile.avatarUrl,
    subscriptionTier: profile.subscriptionTier === "plus" ? "plus" : "free",
    isAdmin: profile.isAdmin,
    stats: {
      booksThisYear,
      dayStreak: streak?.currentStreak ?? 0,
      highlights: streak?.totalHighlights ?? 0,
    },
    vocabularyToMaster,
  };
}

/** A featured celebrity-picks club for the Celebrity Picks mega-menu. */
export interface NavFeaturedClub {
  slug: string;
  name: string;
}

/** The published Book of the Month for the mega-menu card, or null when none is live. */
export interface NavBotm {
  title: string;
  author: string;
}

export interface NavMenu {
  featuredClubs: NavFeaturedClub[];
  botm: NavBotm | null;
}

/** Public mega-menu data (featured picks clubs + published BOTM), shown to everyone.
 *  Resolved in-process via core so the menus render server-side with no client fetch;
 *  the anonymous response is edge-cacheable. getCurrentBotm already filters to published
 *  rows, so the BOTM card self-omits when nothing is live. */
export async function getNavMenu(env: Env): Promise<NavMenu> {
  const db = createDb(env.DB);
  const [clubs, botm] = await Promise.all([
    catalogRepo.listExternalClubs(db),
    catalogRepo.getCurrentBotm(db),
  ]);
  return {
    featuredClubs: clubs.slice(0, 6).map((c) => ({ slug: c.slug, name: c.name })),
    botm: botm?.book ? { title: botm.book.title, author: botm.book.author } : null,
  };
}
