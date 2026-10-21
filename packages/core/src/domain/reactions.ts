// Reactions domain. Generic like/reaction over the one reactions table.
// Phase 6 wires reading_list + diary_entry targets (list likes, review likes). Target
// existence is checked via owner resolution; a reaction on a public target notifies its
// author (never self).
import type { Db } from "../db";
import { emit, type EventActor } from "../events";
import * as reactionsRepo from "../repositories/reactions";
import type { ReactionInput } from "../validators/social";
import { domainErrors } from "./errors";

export async function addReaction(db: Db, actor: EventActor, input: ReactionInput): Promise<void> {
  const kind = input.kind ?? "like";
  const ownerId = await reactionsRepo.resolveTargetOwner(db, input.targetType, input.targetId);
  if (ownerId === null) throw domainErrors.notFound("That item no longer exists.");

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
