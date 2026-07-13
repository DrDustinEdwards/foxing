// Annotation write domain. The single seam the reader's annotation-create path calls:
// it resolves the audience for a new annotation from the user's default-annotation
// visibility preference (profiles.visibility.defaultAnnotation) when the caller does not
// set one explicitly, then inserts. This is the read-side consumption of the pref that
// settings writes (Phase 6 resolved it only on write; this consumes it). Keeping the
// default in core means web and mobile seed the same audience.
import type { Db } from "../db";
import * as annotationsRepo from "../repositories/annotations";
import type { Annotation, NewAnnotation } from "../repositories/annotations";
import * as clubsRepo from "../repositories/clubs";
import type { Profile } from "../repositories/profiles";
import type { CreatePassageCommentInput } from "../validators/annotation";
import { domainErrors } from "./errors";
import { isActiveMember } from "./membership";

export type AnnotationVisibility = "private" | "friends" | "public";
// The audience a user may explicitly choose for a personal annotation. 'club' is the
// share-to-club exposure (club_id still NULL); it is a valid explicit choice but never a
// resolved default (defaults stay private/friends/public).
export type ExplicitAnnotationVisibility = AnnotationVisibility | "club";

/** The audience a new highlight/note starts with for this user, from their default
 *  pref. Anything unrecognised (or absent) falls back to private, the safe default. */
export function resolveDefaultAnnotationVisibility(profile: Profile): AnnotationVisibility {
  const pref = profile.visibility?.defaultAnnotation;
  return pref === "friends" || pref === "public" ? pref : "private";
}

/** Create an annotation for a user, seeding its visibility from their default when the
 *  caller does not specify one. userId is taken from the profile, never trusted from
 *  input. The reader calls this so a new highlight inherits the reader's chosen default.
 *  Returns the full row (the reader reconciles its local state against it); a
 *  client-supplied id and normalized-text derivation are handled in the repo insert. */
export async function createAnnotation(
  db: Db,
  profile: Profile,
  input: Omit<NewAnnotation, "userId" | "visibility"> & {
    visibility?: ExplicitAnnotationVisibility;
  },
): Promise<Annotation> {
  const visibility = input.visibility ?? resolveDefaultAnnotationVisibility(profile);
  return annotationsRepo.createAnnotation(db, { ...input, userId: profile.id, visibility });
}

/** REQUIRED authorization gate for the club passage layer: the actor must be an ACTIVE
 *  member of the club they are posting into. A non-member (invited/left/banned/absent)
 *  must never write into a club's passage thread. Throws forbidden otherwise. */
export async function assertActiveMember(db: Db, clubId: string, userId: string): Promise<void> {
  const m = await clubsRepo.getMembership(db, clubId, userId);
  if (!m || !isActiveMember(m.status)) {
    throw domainErrors.forbidden("Join this club to post in its passages.");
  }
}

/** Create a passage comment (type='comment'). Club-scoped by construction: its audience
 *  is the club (visibility='club'), never a personal visibility. Gated on active club
 *  membership BEFORE the insert, so an unauthorized post never reaches the table. */
export async function createPassageComment(
  db: Db,
  userId: string,
  input: CreatePassageCommentInput,
): Promise<Annotation> {
  await assertActiveMember(db, input.clubId, userId);
  return annotationsRepo.createAnnotation(db, {
    id: input.id ?? null,
    userId,
    type: "comment",
    bookId: input.bookId,
    clubId: input.clubId,
    locator: input.locator ?? null,
    body: input.body,
    parentId: input.parentId ?? null,
    visibility: "club",
    containsSpoilers: input.containsSpoilers ?? false,
  });
}
