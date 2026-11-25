import type { Db } from "../db";
import type { ClubMemberRole } from "../enums";
import * as clubsRepo from "../repositories/clubs";
import { domainErrors } from "./errors";
import * as membership from "./membership";

export async function requireActive(
  db: Db,
  clubId: string,
  userId: string,
): Promise<clubsRepo.ClubMember> {
  const m = await clubsRepo.getMembership(db, clubId, userId);
  if (!m || !membership.isActiveMember(m.status)) {
    throw domainErrors.forbidden("Join this club first.");
  }
  return m;
}

export async function requireModerator(
  db: Db,
  clubId: string,
  userId: string,
): Promise<clubsRepo.ClubMember> {
  const m = await requireActive(db, clubId, userId);
  if (!membership.canModerate(m.role as ClubMemberRole)) {
    throw domainErrors.forbidden("Moderator access required.");
  }
  return m;
}

// Clubs are free (Plus gates the AI companion, never clubs); everything below is membership/role authorization.

export async function requireClub(db: Db, clubId: string): Promise<clubsRepo.Club> {
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");
  return club;
}
