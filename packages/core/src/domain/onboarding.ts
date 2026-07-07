// Onboarding domain logic. Creates the profile row for a freshly signed-up user
// and emits the profile.onboarded event (the one real emission wired in Phase 1).
import type { Db } from "../db";
import { emit } from "../events";
import { createProfile, type Profile } from "../repositories/profiles";
import type { OnboardInput } from "../validators/profile";

export async function onboardProfile(
  db: Db,
  userId: string,
  input: OnboardInput,
): Promise<Profile> {
  const profile = await createProfile(db, {
    id: userId,
    username: input.username,
    displayName: input.displayName ?? null,
    timezone: input.timezone ?? null,
    favoriteGenres: input.favoriteGenres ?? null,
    onboardedAt: new Date(),
  });

  await emit(
    db,
    "profile.onboarded",
    { userId, timezone: profile.timezone },
    { username: profile.username },
  );

  return profile;
}
