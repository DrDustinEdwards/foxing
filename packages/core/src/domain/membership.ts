// Pure club-membership state machine: no DB; the clubs domain layer composes it with repo reads and writes.
import type { ClubMemberRole, ClubMemberStatus } from "../enums";

export const ROLE_RANK: Record<ClubMemberRole, number> = {
  member: 0,
  moderator: 1,
  owner: 2,
};

export function isActiveMember(status: string | null | undefined): boolean {
  return status === "active";
}

export function canModerate(role: ClubMemberRole | null | undefined): boolean {
  return role === "owner" || role === "moderator";
}

export function resolveJoinStatus(
  club: { memberApproval: boolean; maxMembers: number | null },
  activeCount: number,
): Extract<ClubMemberStatus, "active" | "requested" | "waitlisted"> {
  if (club.memberApproval) return "requested";
  if (club.maxMembers != null && activeCount >= club.maxMembers) return "waitlisted";
  return "active";
}

export function canApprove(current: string): boolean {
  return current === "requested" || current === "waitlisted";
}

/** Whether `actor` may act on `target` for a moderation action (ban/mute/role).
 *  Owners may act on anyone but themselves; moderators may act only on plain members;
 *  no one may act on an owner. */
export function canActOn(actorRole: ClubMemberRole, targetRole: ClubMemberRole): boolean {
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "moderator") return targetRole === "member";
  return false;
}

/** Only an owner may change roles, never their own; ownership transfer is out of scope. */
export function canSetRole(
  actorRole: ClubMemberRole,
  targetRole: ClubMemberRole,
  newRole: ClubMemberRole,
): boolean {
  if (actorRole !== "owner") return false;
  if (targetRole === "owner" || newRole === "owner") return false;
  return true;
}

/** Successors for a deleted owner, best first: active members other than the leaver, moderators before plain members, earlier joiners first. Empty means the club goes with the account. */
export function rankSuccessors<
  M extends { userId: string; status: string; role: string; joinedAt: Date | null },
>(members: M[], leavingUserId: string): M[] {
  const joined = (m: M) => m.joinedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const mod = (m: M) => Number(canModerate(m.role as ClubMemberRole));
  return members
    .filter((m) => m.userId !== leavingUserId && isActiveMember(m.status))
    .sort((a, b) => mod(b) - mod(a) || joined(a) - joined(b));
}

export function canUnban(current: string): boolean {
  return current === "banned";
}

/** A mute lasts a bounded number of minutes; 0 clears it. Returns the epoch-ms expiry (null = unmuted); the caller supplies "now". */
export function muteUntil(nowMs: number, minutes: number): number | null {
  return minutes > 0 ? nowMs + minutes * 60_000 : null;
}

export function isMuted(mutedUntil: Date | null | undefined, nowMs: number): boolean {
  return mutedUntil != null && mutedUntil.getTime() > nowMs;
}
