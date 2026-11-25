// Reactions over the one reactions table. Target existence is checked via owner resolution; a reaction on a public target notifies its author (never self).
import type { Db } from "../db";
import { emit, type EventActor } from "../events";
import * as clubsRepo from "../repositories/clubs";
import * as readerSocial from "../repositories/reader-social";
import * as reactionsRepo from "../repositories/reactions";
import type { ReactionInput } from "../validators/social";
import { domainErrors } from "./errors";

async function canReact(
  db: Db,
  viewerId: string,
  { owner, visibility }: { owner: string; visibility: string },
): Promise<boolean> {
  if (owner === viewerId || visibility === "public") return true;
  if (visibility === "friends") {
    return (await readerSocial.closeFriendAuthorIds(db, viewerId)).includes(owner);
  }
  if (visibility !== "club") return false;
  const clubIds = (await clubsRepo.listClubsForUser(db, viewerId)).map((c) => c.id);
  return (await readerSocial.coReadingAuthorIds(db, clubIds, viewerId)).includes(owner);
}

export async function addReaction(db: Db, actor: EventActor, input: ReactionInput): Promise<void> {
  const kind = input.kind ?? "like";
  const target = await reactionsRepo.resolveTarget(db, input.targetType, input.targetId);
  // A target the actor cannot read answers like a missing one: no existence oracle for private rows.
  if (!target || !(await canReact(db, actor.userId, target))) {
    throw domainErrors.notFound("That item no longer exists.");
  }
  const ownerId = target.owner;

  const already = await reactionsRepo.hasReacted(
    db,
    actor.userId,
    input.targetType,
    input.targetId,
    kind,
  );
  await reactionsRepo.addReaction(db, actor.userId, input.targetType, input.targetId, kind);

  // Notify the target owner once, on a new reaction, and never for reacting to your own.
  if (!already && ownerId !== actor.userId) {
    await emit(db, "reaction.created", actor, {
      ownerId,
      targetType: input.targetType,
      targetId: input.targetId,
      kind,
    });
  }
}

export async function removeReaction(
  db: Db,
  actor: EventActor,
  input: ReactionInput,
): Promise<void> {
  const kind = input.kind ?? "like";
  await reactionsRepo.removeReaction(db, actor.userId, input.targetType, input.targetId, kind);
}
