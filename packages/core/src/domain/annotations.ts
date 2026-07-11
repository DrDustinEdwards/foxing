// Annotation write domain. The single seam the reader's annotation-create path calls:
// it resolves the audience for a new annotation from the user's default-annotation
// visibility preference (profiles.visibility.defaultAnnotation) when the caller does not
// set one explicitly, then inserts. This is the read-side consumption of the pref that
// settings writes (Phase 6 resolved it only on write; this consumes it). Keeping the
// default in core means web and mobile seed the same audience.
import type { Db } from "../db";
import * as annotationsRepo from "../repositories/annotations";
import type { NewAnnotation } from "../repositories/annotations";
import type { Profile } from "../repositories/profiles";

export type AnnotationVisibility = "private" | "friends" | "public";

/** The audience a new highlight/note starts with for this user, from their default
 *  pref. Anything unrecognised (or absent) falls back to private, the safe default. */
export function resolveDefaultAnnotationVisibility(profile: Profile): AnnotationVisibility {
  const pref = profile.visibility?.defaultAnnotation;
  return pref === "friends" || pref === "public" ? pref : "private";
}

/** Create an annotation for a user, seeding its visibility from their default when the
 *  caller does not specify one. userId is taken from the profile, never trusted from
 *  input. The reader calls this so a new highlight inherits the reader's chosen default. */
export async function createAnnotation(
  db: Db,
  profile: Profile,
  input: Omit<NewAnnotation, "userId" | "visibility"> & { visibility?: AnnotationVisibility },
): Promise<string> {
  const visibility = input.visibility ?? resolveDefaultAnnotationVisibility(profile);
  return annotationsRepo.createAnnotation(db, { ...input, userId: profile.id, visibility });
}
