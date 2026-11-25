// Nav identity for the signed-in shell, resolved in the root loader. Safe to SSR because the Worker bypasses the edge
// cache whenever a better-auth cookie is present. Reads run in-process via core (loaders never self-fetch /api/v1).
import { isAdminEmail } from "@dustinedwards/site-runtime/access";
import { catalogRepo, createDb, libraryRepo, profilesRepo, views } from "@foxing/core";
import { sessionUserFromRequest } from "./auth.server";

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

/** The signed-in nav identity, or null for anonymous or not-yet-onboarded users (page loaders route those to /onboarding). */
export async function getNavUser(env: Env, request: Request): Promise<NavUser | null> {
  const user = await sessionUserFromRequest(request, env);
  if (!user) return null;

  const db = createDb(env.DB);
  const profile = await profilesRepo.getProfileById(db, user.id);
  if (!profile) return null;

  const year = new Date().getUTCFullYear();
  const [streak, booksThisYear, vocabularyToMaster] = await Promise.all([
    views.streak(db, user.id),
    libraryRepo.countFinishedInPeriod(db, user.id, { periodType: "year", year }),
    libraryRepo.countVocabularyToMaster(db, user.id),
  ]);

  return {
    username: profile.username,
    displayName: profile.displayName ?? profile.username,
    avatarUrl: profile.avatarUrl,
    subscriptionTier: profile.subscriptionTier === "plus" ? "plus" : "free",
    isAdmin: isAdminEmail(env, user.email),
    stats: {
      booksThisYear,
      dayStreak: streak.currentStreak,
      highlights: streak.totalHighlights,
    },
    vocabularyToMaster,
  };
}

export interface NavFeaturedClub {
  slug: string;
  name: string;
}

export interface NavBotm {
  title: string;
  author: string;
}

export interface NavMenu {
  featuredClubs: NavFeaturedClub[];
  botm: NavBotm | null;
}

/** Public mega-menu data, resolved in-process so it renders server-side and the anonymous response is edge-cacheable. */
export async function getNavMenu(env: Env): Promise<NavMenu> {
  const db = createDb(env.DB, env.APP_KV);
  const [clubs, botm] = await Promise.all([
    catalogRepo.listExternalClubs(db),
    catalogRepo.getCurrentBotm(db),
  ]);
  return {
    featuredClubs: clubs.slice(0, 6).map((c) => ({ slug: c.slug, name: c.name })),
    botm: botm?.book ? { title: botm.book.title, author: botm.book.author } : null,
  };
}
