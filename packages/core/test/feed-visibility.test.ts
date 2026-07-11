// The critical Phase 6 test: the feed visibility resolution matrix. resolveFeed is the
// pure core function that decides, per viewer, which activity events are visible. The
// contract (reviewed + approved): the follow graph and the close-friends graph are
// INDEPENDENT.
//   - public event by A:  shown IFF the viewer follows A.
//   - friends event by A: shown IFF the viewer is on A's close-friends list (NOT enough
//                         to merely follow A).
//   - private event:      never shown to anyone.
// The bug this guards against is "follows implies friends" leaking friends-only content
// to every follower. Every cell of {follower, close-friend, both, stranger} x
// {public, friends, private} is asserted below, with an explicit check that a plain
// follower does NOT see a friends-only event.
import { describe, expect, it } from "vitest";
import { resolveFeed } from "../src/domain/social";

const AUTHOR = "author-A";
const VIEWER = "viewer-V";

function event(visibility: string, id = visibility) {
  return {
    id: `evt-${id}`,
    userId: AUTHOR,
    type: "reviewed",
    bookId: null,
    targetId: null,
    data: {},
    visibility,
    createdAt: new Date(1_000),
  };
}

const PUBLIC = event("public");
const FRIENDS = event("friends");
const PRIVATE = event("private");
const ALL = [PUBLIC, FRIENDS, PRIVATE];

// Relationship fixtures: how the viewer relates to AUTHOR.
const REL = {
  follower: { followingIds: [AUTHOR], closeFriendAuthorIds: [] as string[] },
  closeFriend: { followingIds: [] as string[], closeFriendAuthorIds: [AUTHOR] },
  both: { followingIds: [AUTHOR], closeFriendAuthorIds: [AUTHOR] },
  stranger: { followingIds: [] as string[], closeFriendAuthorIds: [] as string[] },
};

function visibleIds(rel: (typeof REL)[keyof typeof REL]) {
  return resolveFeed({ viewerId: VIEWER, ...rel, events: ALL })
    .map((e) => e.visibility)
    .sort();
}

describe("resolveFeed - visibility matrix (every cell)", () => {
  it("follower: sees public, NOT friends, NOT private", () => {
    expect(visibleIds(REL.follower)).toEqual(["public"]);
  });

  it("close friend (not following): sees friends, NOT public, NOT private", () => {
    expect(visibleIds(REL.closeFriend)).toEqual(["friends"]);
  });

  it("both follower and close friend: sees public AND friends, NOT private", () => {
    expect(visibleIds(REL.both)).toEqual(["friends", "public"]);
  });

  it("stranger: sees nothing", () => {
    expect(visibleIds(REL.stranger)).toEqual([]);
  });

  // The single most important assertion: following alone must NEVER reveal friends-only.
  it("a plain follower does NOT see a friends-only event", () => {
    const out = resolveFeed({
      viewerId: VIEWER,
      ...REL.follower,
      events: [FRIENDS],
    });
    expect(out).toHaveLength(0);
  });

  it("private is never visible, to any relationship", () => {
    for (const rel of Object.values(REL)) {
      const out = resolveFeed({ viewerId: VIEWER, ...rel, events: [PRIVATE] });
      expect(out).toHaveLength(0);
    }
  });

  it("an unknown visibility value is treated as hidden (fail closed)", () => {
    const weird = event("wat", "weird");
    const out = resolveFeed({ viewerId: VIEWER, ...REL.both, events: [weird] });
    expect(out).toHaveLength(0);
  });

  it("excludes the viewer's own events even if they are in the author set", () => {
    const own = { ...event("public", "own"), userId: VIEWER };
    const out = resolveFeed({
      viewerId: VIEWER,
      followingIds: [VIEWER],
      closeFriendAuthorIds: [VIEWER],
      events: [own],
    });
    expect(out).toHaveLength(0);
  });

  it("resolves each author independently in a mixed set", () => {
    const B = "author-B";
    const events = [
      { ...event("public", "a-pub") }, // author A, public
      { ...event("friends", "a-fr") }, // author A, friends
      { ...event("public", "b-pub"), userId: B }, // author B, public
      { ...event("friends", "b-fr"), userId: B }, // author B, friends
    ];
    // Viewer follows A (public only) and is a close friend of B (friends only).
    const out = resolveFeed({
      viewerId: VIEWER,
      followingIds: [AUTHOR],
      closeFriendAuthorIds: [B],
      events,
    });
    const ids = out.map((e) => e.id).sort();
    expect(ids).toEqual(["evt-a-pub", "evt-b-fr"]);
  });
});
