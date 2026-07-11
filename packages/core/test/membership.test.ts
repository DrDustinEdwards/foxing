import { describe, expect, it } from "vitest";
import {
  ROLE_RANK,
  canActOn,
  canApprove,
  canModerate,
  canSetRole,
  canUnban,
  isActiveMember,
  isMuted,
  muteUntil,
  resolveJoinStatus,
} from "../src/domain/membership";

describe("role helpers", () => {
  it("ranks owner > moderator > member", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.moderator);
    expect(ROLE_RANK.moderator).toBeGreaterThan(ROLE_RANK.member);
  });

  it("only active status counts as a member", () => {
    expect(isActiveMember("active")).toBe(true);
    for (const s of ["requested", "waitlisted", "banned", "left", null, undefined]) {
      expect(isActiveMember(s as string)).toBe(false);
    }
  });

  it("owners and moderators can moderate", () => {
    expect(canModerate("owner")).toBe(true);
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("member")).toBe(false);
    expect(canModerate(null)).toBe(false);
  });
});

describe("resolveJoinStatus", () => {
  it("requires approval when the club is approval-gated", () => {
    expect(resolveJoinStatus({ memberApproval: true, maxMembers: null }, 0)).toBe("requested");
  });

  it("waitlists when the club is at capacity", () => {
    expect(resolveJoinStatus({ memberApproval: false, maxMembers: 5 }, 5)).toBe("waitlisted");
  });

  it("joins directly for an open club with room", () => {
    expect(resolveJoinStatus({ memberApproval: false, maxMembers: 10 }, 3)).toBe("active");
    expect(resolveJoinStatus({ memberApproval: false, maxMembers: null }, 999)).toBe("active");
  });
});

describe("moderation guards", () => {
  it("approves only pending statuses", () => {
    expect(canApprove("requested")).toBe(true);
    expect(canApprove("waitlisted")).toBe(true);
    expect(canApprove("active")).toBe(false);
    expect(canApprove("banned")).toBe(false);
  });

  it("unbans only banned members", () => {
    expect(canUnban("banned")).toBe(true);
    expect(canUnban("active")).toBe(false);
  });

  it("owner acts on anyone but an owner; moderator only on members", () => {
    expect(canActOn("owner", "moderator")).toBe(true);
    expect(canActOn("owner", "member")).toBe(true);
    expect(canActOn("owner", "owner")).toBe(false);
    expect(canActOn("moderator", "member")).toBe(true);
    expect(canActOn("moderator", "moderator")).toBe(false);
    expect(canActOn("member", "member")).toBe(false);
  });

  it("only the owner sets roles, and never to/from owner", () => {
    expect(canSetRole("owner", "member", "moderator")).toBe(true);
    expect(canSetRole("owner", "moderator", "member")).toBe(true);
    expect(canSetRole("owner", "member", "owner")).toBe(false);
    expect(canSetRole("owner", "owner", "member")).toBe(false);
    expect(canSetRole("moderator", "member", "moderator")).toBe(false);
  });
});

describe("mute", () => {
  it("computes a bounded expiry and clears at 0", () => {
    expect(muteUntil(1000, 10)).toBe(1000 + 10 * 60_000);
    expect(muteUntil(1000, 0)).toBeNull();
  });

  it("reports whether a mute is still in force", () => {
    expect(isMuted(new Date(2000), 1000)).toBe(true);
    expect(isMuted(new Date(500), 1000)).toBe(false);
    expect(isMuted(null, 1000)).toBe(false);
  });
});
