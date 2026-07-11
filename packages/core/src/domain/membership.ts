// Pure club-membership state machine (Phase 5). No DB: given the current status/role
// and the club settings, decide the next state and who is allowed to act. The clubs
// domain layer composes these with repo reads/writes; unit-tested in membership.test.ts.
import type { ClubMemberRole, ClubMemberStatus } from "../enums";

export const ROLE_RANK: Record<ClubMemberRole, number> = {
  member: 0,
  moderator: 1,
  owner: 2,
};

/** An active member is the only status that can read/post in a club. Accepts the raw
 *  text-column value (D1 stores status as text). */
export function isActiveMember(status: string | null | undefined): boolean {
  return status === "active";
}

/** Moderators and owners can moderate (approve, ban, mute, remove posts). */
export function canModerate(role: ClubMemberRole | null | undefined): boolean {
  return role === "owner" || role === "moderator";
}

/** Where a fresh join lands, given club settings and current capacity. */
export function resolveJoinStatus(
  club: { memberApproval: boolean; maxMembers: number | null },
  activeCount: number,
): Extract<ClubMemberStatus, "active" | "requested" | "waitlisted"> {
  if (club.memberApproval) return "requested";
  if (club.maxMembers != null && activeCount >= club.maxMembers) return "waitlisted";
  return "active";
}

/** A pending member (requested or waitlisted) can be approved into the club. */
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

/** Only an owner may change roles, and never their own. Promotes/demotes between
 *  member and moderator; ownership transfer is out of scope for Phase 5. */
export function canSetRole(
  actorRole: ClubMemberRole,
  targetRole: ClubMemberRole,
  newRole: ClubMemberRole,
): boolean {
  if (actorRole !== "owner") return false;
  if (targetRole === "owner" || newRole === "owner") return false;
  return true;
}

/** Unban restores a previously banned user to active membership. */
export function canUnban(current: string): boolean {
  return current === "banned";
}

/** A mute lasts a bounded number of minutes; 0 clears it. Returns the epoch-ms
 *  expiry (null = unmuted). Pure: the caller supplies "now" so it stays testable. */
export function muteUntil(nowMs: number, minutes: number): number | null {
  return minutes > 0 ? nowMs + minutes * 60_000 : null;
}

/** True when a mute is still in force at `nowMs`. */
export function isMuted(mutedUntil: Date | null | undefined, nowMs: number): boolean {
  return mutedUntil != null && mutedUntil.getTime() > nowMs;
}
