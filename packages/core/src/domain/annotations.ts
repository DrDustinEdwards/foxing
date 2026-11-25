// Annotation write seam: resolves a new annotation's audience from profiles.visibility.defaultAnnotation when the caller sets none,
// so web and mobile seed the same default, then inserts.
import type { Db } from "../db";
import * as annotationsRepo from "../repositories/annotations";
import type { Annotation, NewAnnotation } from "../repositories/annotations";
import * as clubsRepo from "../repositories/clubs";
import type { Profile } from "../repositories/profiles";
import type { CreatePassageCommentInput } from "../validators/annotation";
import { domainErrors } from "./errors";
import { isActiveMember } from "./membership";

export type AnnotationVisibility = "private" | "friends" | "public";
// 'club' is the share-to-club exposure (club_id still NULL): a valid explicit choice, never a resolved default.
export type ExplicitAnnotationVisibility = AnnotationVisibility | "club";

export function resolveDefaultAnnotationVisibility(profile: Profile): AnnotationVisibility {
  const pref = profile.visibility?.defaultAnnotation;
  return pref === "friends" || pref === "public" ? pref : "private";
}

/** userId is taken from the profile, never trusted from input. */
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

/** REQUIRED gate for the club passage layer: only an ACTIVE member may write into a club's passage thread. Throws forbidden otherwise. */
export async function assertActiveMember(db: Db, clubId: string, userId: string): Promise<void> {
  const m = await clubsRepo.getMembership(db, clubId, userId);
  if (!m || !isActiveMember(m.status)) {
    throw domainErrors.forbidden("Join this club to post in its passages.");
  }
}

/** Passage comment: club-scoped by construction (visibility='club'), gated on active membership BEFORE the insert. */
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
