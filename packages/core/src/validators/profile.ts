// Request/response schemas for the profiles resource. Exported from core and
// shared by both clients (typed end to end).
import { z } from "zod";

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, "letters, numbers, and underscores only");

export const onboardInput = z.object({
  username,
  displayName: z.string().trim().max(80).optional(),
  timezone: z.string().max(64).optional(),
  favoriteGenres: z.array(z.string().max(40)).max(20).optional(),
});
export type OnboardInput = z.infer<typeof onboardInput>;

export const updateMeInput = z
  .object({
    displayName: z.string().trim().max(80).nullable(),
    bio: z.string().max(500).nullable(),
    avatarUrl: z.string().url().nullable(),
    backdropUrl: z.string().url().nullable(),
    customUrl: z.string().max(120).nullable(),
    favoriteGenres: z.array(z.string().max(40)).max(20).nullable(),
    languagePreference: z.string().max(10).nullable(),
    themePreference: z.string().max(20).nullable(),
    timezone: z.string().max(64).nullable(),
  })
  .partial();
export type UpdateMeInput = z.infer<typeof updateMeInput>;

// profiles.visibility json prefs. profile/progress are binary (the resolver treats any
// non-"public" value as hidden); defaultAnnotation seeds a new annotation's audience and
// matches the annotation visibility ladder (no "club" -- that is contextual, not a default).
export const profileVisibility = z.enum(["public", "private"]);
export const annotationDefaultVisibility = z.enum(["private", "friends", "public"]);
export const visibilityPrefsInput = z
  .object({
    profile: profileVisibility,
    progress: profileVisibility,
    defaultAnnotation: annotationDefaultVisibility,
  })
  .partial();
export type VisibilityPrefsInput = z.infer<typeof visibilityPrefsInput>;

/** DELETE /account: who takes over each club the user created (a member's user id), or
 *  null to delete that club. Clubs left out get their suggested successor. */
export const deleteAccountInput = z.object({
  successors: z.record(z.string(), z.string().nullable()).default({}),
});
