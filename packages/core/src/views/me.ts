// The signed-in reader's own account in its /api/v1 wire shape (@foxing/types).
import type * as W from "@foxing/types";
import type { Profile } from "../repositories/profiles";
import { ms } from "./wire";

/** Stored visibility strings, read the way every surface reads them: anything but
 *  "private" is public, and annotations default to private. */
function visibility(v: Profile["visibility"]): W.MyProfile["visibility"] {
  const a = v?.defaultAnnotation;
  return {
    profile: v?.profile === "private" ? "private" : "public",
    progress: v?.progress === "private" ? "private" : "public",
    defaultAnnotation: a === "friends" || a === "public" ? a : "private",
  };
}

export function myProfile(p: Profile): W.MyProfile {
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    backdropUrl: p.backdropUrl,
    bio: p.bio,
    favoriteGenres: p.favoriteGenres ?? [],
    subscriptionTier: p.subscriptionTier === "plus" ? "plus" : "free",
    subscriptionStatus: p.subscriptionStatus,
    subscriptionPeriodEnd: ms(p.subscriptionPeriodEnd),
    isAdmin: p.isAdmin,
    timezone: p.timezone,
    visibility: visibility(p.visibility),
    notificationPrefs: p.notificationPrefs ?? {},
    createdAt: p.createdAt.getTime(),
  };
}

export function me(user: { id: string; email: string }, profile: Profile | null): W.Me {
  return { user: { id: user.id, email: user.email }, profile: profile ? myProfile(profile) : null };
}
