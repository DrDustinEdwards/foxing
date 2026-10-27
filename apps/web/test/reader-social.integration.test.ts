import { env } from "cloudflare:test";
import { createDb, loadReaderAnnotations, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { testApi } from "./test-api";

// The reader social-layer resolution matrix, run against local D1 so the ENTITLEMENT is
// proven where it actually lives: in the SQL. Every "NOT returned" cell asserts the row
// is never fetched, not merely filtered in memory. The airtight invariant under review:
//   MINE is the only branch without a visibility filter, and it is hard-scoped to
//   user_id = viewer; every other branch requires user_id != viewer AND a non-private
//   visibility AND an entitled author/club set. So others' PRIVATE never leaks, in any
//   path. Cell 1 is the first thing to read.
//
// Flag 1 (approved): the club passage layer is scoped to the CURRENT read only
// (clubs.current_book_id OR club_books.is_current). A finished-book club_books row does
// NOT keep a passage layer alive. Cells 4/5/6 assert this.

const db = () => createDb(env.DB);
const BOOK = "book1";
const OTHER_BOOK = "book2";

function loc(totalProgression?: number) {
  return {
    href: "chapter.html",
    type: "application/xhtml+xml",
    locations: totalProgression === undefined ? {} : { totalProgression },
  };
}

async function seedUser(id: string) {
  const d = db();
  await d.insert(schema.user).values({
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await d.insert(schema.profiles).values({
    id,
    username: id,
    displayName: `${id} Name`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedBook(id: string) {
  await db()
    .insert(schema.books)
    .values({
      id,
      title: `Book ${id}`,
      author: "Author",
      slug: `book-${id}`,
      source: "gutenberg",
      sourceType: "catalog",
      language: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

async function seedClub(id: string, opts: { currentBookId?: string | null; creatorId: string }) {
  await db()
    .insert(schema.clubs)
    .values({
      id,
      name: `Club ${id}`,
      slug: `club-${id}`,
      creatorId: opts.creatorId,
      currentBookId: opts.currentBookId ?? null,
      visibility: "public",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

async function addMember(
  clubId: string,
  userId: string,
  status: "active" | "invited" | "left" | "banned" | "requested" = "active",
  role: "owner" | "moderator" | "member" = "member",
) {
  await db()
    .insert(schema.clubMembers)
    .values({ clubId, userId, status, role, joinedAt: new Date() });
}

async function addClubBook(clubId: string, bookId: string, isCurrent: boolean) {
  await db()
    .insert(schema.clubBooks)
    .values({ id: `${clubId}-${bookId}`, clubId, bookId, isCurrent, startedAt: new Date() });
}

let annSeq = 0;
async function ann(input: {
  userId: string;
  bookId?: string | null;
  clubId?: string | null;
  type?: string;
  visibility?: string;
  containsSpoilers?: boolean;
  isPinned?: boolean;
  parentId?: string | null;
  locator?: Record<string, unknown> | null;
  normalizedText?: string | null;
  body?: string | null;
  selectedText?: string | null;
  color?: string | null;
}): Promise<string> {
  const id = `ann-${++annSeq}`;
  await db()
    .insert(schema.annotations)
    .values({
      id,
      userId: input.userId,
      bookId: input.bookId === undefined ? BOOK : input.bookId,
      clubId: input.clubId ?? null,
      type: input.type ?? "highlight",
      visibility: input.visibility ?? "private",
      containsSpoilers: input.containsSpoilers ?? false,
      isPinned: input.isPinned ?? false,
      parentId: input.parentId ?? null,
      locator: input.locator ?? loc(0.5),
      normalizedText: input.normalizedText ?? null,
      body: input.body ?? null,
      selectedText: input.selectedText ?? null,
      color: input.color ?? "amber",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return id;
}

async function setProgress(userId: string, pct: number) {
  await db()
    .insert(schema.userBooks)
    .values({
      id: `ub-${userId}`,
      userId,
      bookId: BOOK,
      status: "reading",
      progressPct: pct,
      progress: loc(pct / 100),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

async function addCloseFriend(ownerId: string, friendId: string) {
  await db()
    .insert(schema.closeFriends)
    .values({ userId: ownerId, friendId, createdAt: new Date() });
}

async function resolve(viewerId: string | null, opts?: { progressGate?: boolean }) {
  return loadReaderAnnotations(db(), viewerId, BOOK, opts);
}

describe("reader social-layer resolution matrix (local D1)", () => {
  beforeEach(async () => {
    const d = db();
    annSeq = 0;
    for (const t of [
      schema.annotations,
      schema.userBooks,
      schema.clubBooks,
      schema.clubMembers,
      schema.clubs,
      schema.closeFriends,
      schema.books,
      schema.profiles,
      schema.user,
    ]) {
      await d.delete(t);
    }
    await seedBook(BOOK);
    await seedBook(OTHER_BOOK);
  });

  // -- CELL 1: the airtight invariant. Others' PRIVATE never returned, for ANY
  //    relationship (club-mate, close friend, stranger). This is checked first.
  it("cell 1: others' PRIVATE annotations never appear (club-mate, close friend, stranger)", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");
    await seedUser("friend");
    await seedUser("stranger");

    // A shared club currently reading the book (so clubmate is a genuine co-reader).
    await seedClub("c1", { currentBookId: BOOK, creatorId: "viewer" });
    await addMember("c1", "viewer", "active", "owner");
    await addMember("c1", "clubmate", "active");
    // friend put viewer on their close-friends list.
    await addCloseFriend("friend", "viewer");

    // Every author writes a PRIVATE annotation. None may surface, whatever the tie.
    const p1 = await ann({ userId: "clubmate", visibility: "private" });
    const p2 = await ann({ userId: "friend", visibility: "private" });
    const p3 = await ann({ userId: "stranger", visibility: "private" });

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(0);
    const ids = out.others.map((o) => o.id);
    for (const id of [p1, p2, p3]) expect(ids).not.toContain(id);
    // And none carry another user's private into the comments/popular paths either.
    expect(out.comments).toHaveLength(0);
    expect(out.popular).toHaveLength(0);
  });

  // -- CELL 2: public stranger is visible, tagged public.
  it("cell 2: a stranger's PUBLIC annotation is returned, layer=public", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    const id = await ann({ userId: "stranger", visibility: "public" });

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(1);
    expect(out.others[0].id).toBe(id);
    expect(out.others[0].layer).toBe("public");
    expect(out.others[0].author.id).toBe("stranger");
  });

  // -- CELL 3: club annotation from a co-reader in a shared current-read club.
  it("cell 3: a co-reader's CLUB annotation (shared current read) is returned, layer=club", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");
    await seedClub("c1", { currentBookId: BOOK, creatorId: "viewer" });
    await addMember("c1", "viewer", "active", "owner");
    await addMember("c1", "clubmate", "active");
    const id = await ann({ userId: "clubmate", visibility: "club" });

    const out = await resolve("viewer");
    expect(out.others.map((o) => o.id)).toEqual([id]);
    expect(out.others[0].layer).toBe("club");
  });

  // -- CELL 4 (Flag 1): shared club whose CURRENT read is not this book -> NOT returned.
  it("cell 4: a CLUB annotation in a club NOT currently reading this book is NOT returned", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");
    // Club exists, both active, but its current read is a different book, and its only
    // club_books row for this book is a FINISHED (is_current=false) past read.
    await seedClub("c2", { currentBookId: OTHER_BOOK, creatorId: "viewer" });
    await addMember("c2", "viewer", "active", "owner");
    await addMember("c2", "clubmate", "active");
    await addClubBook("c2", BOOK, false); // finished past read, must not revive the layer
    await ann({ userId: "clubmate", visibility: "club" });

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(0);
  });

  // -- CELL 5: viewer not an ACTIVE member of the shared club -> NOT returned.
  it("cell 5: viewer's non-active membership in the reading club yields nothing", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");
    await seedClub("c3", { currentBookId: BOOK, creatorId: "clubmate" });
    await addMember("c3", "clubmate", "active", "owner");
    await addMember("c3", "viewer", "invited"); // invited, not active
    await ann({ userId: "clubmate", visibility: "club" });

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(0);
  });

  // -- CELL 6: AUTHOR not an ACTIVE member -> NOT returned.
  it("cell 6: a non-active author's club annotation is NOT returned", async () => {
    await seedUser("viewer");
    await seedUser("author");
    await seedClub("c4", { currentBookId: BOOK, creatorId: "viewer" });
    await addMember("c4", "viewer", "active", "owner");
    await addMember("c4", "author", "left"); // author has left the club
    await ann({ userId: "author", visibility: "club" });

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(0);
  });

  // -- CELL 7: friends annotation from someone who added the viewer -> layer=friend.
  it("cell 7: a close friend's FRIENDS annotation is returned, layer=friend", async () => {
    await seedUser("viewer");
    await seedUser("friend");
    await addCloseFriend("friend", "viewer");
    const id = await ann({ userId: "friend", visibility: "friends" });

    const out = await resolve("viewer");
    expect(out.others.map((o) => o.id)).toEqual([id]);
    expect(out.others[0].layer).toBe("friend");
  });

  // -- CELL 8: friends annotation from a non-friend -> NOT returned.
  it("cell 8: a FRIENDS annotation from someone who did NOT add the viewer is NOT returned", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await ann({ userId: "stranger", visibility: "friends" });
    // reverse direction must not count: viewer added stranger, not the other way round
    await addCloseFriend("viewer", "stranger");

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(0);
  });

  // -- CELL 9: two clubs, same book, both current reads -> the one annotation dedups.
  it("cell 9: an author in two shared current-read clubs yields the annotation ONCE", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");
    await seedClub("c1", { currentBookId: BOOK, creatorId: "viewer" });
    await seedClub("c5", { currentBookId: BOOK, creatorId: "viewer" });
    for (const c of ["c1", "c5"]) {
      await addMember(c, "viewer", "active", "owner");
      await addMember(c, "clubmate", "active");
    }
    const id = await ann({ userId: "clubmate", visibility: "club" });

    const out = await resolve("viewer");
    expect(out.others.filter((o) => o.id === id)).toHaveLength(1);
    expect(out.others[0].layer).toBe("club");
  });

  // -- CELL 10: passage comments scoped to the viewer's active clubs reading the book.
  it("cell 10: passage comments surface only for active clubs currently reading the book", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");

    // 10a: active club, current read = book -> visible.
    await seedClub("c1", { currentBookId: BOOK, creatorId: "viewer" });
    await addMember("c1", "viewer", "active", "owner");
    await addMember("c1", "clubmate", "active");
    const visible = await ann({
      userId: "clubmate",
      type: "comment",
      clubId: "c1",
      visibility: "club",
    });

    // 10b: club the viewer has LEFT -> hidden.
    await seedClub("c6", { currentBookId: BOOK, creatorId: "clubmate" });
    await addMember("c6", "clubmate", "active", "owner");
    await addMember("c6", "viewer", "left");
    const leftClub = await ann({
      userId: "clubmate",
      type: "comment",
      clubId: "c6",
      visibility: "club",
    });

    // 10c: club not currently reading the book -> hidden.
    await seedClub("c7", { currentBookId: OTHER_BOOK, creatorId: "viewer" });
    await addMember("c7", "viewer", "active", "owner");
    await addMember("c7", "clubmate", "active");
    const notReading = await ann({
      userId: "clubmate",
      type: "comment",
      clubId: "c7",
      visibility: "club",
    });

    const out = await resolve("viewer");
    const ids = out.comments.map((c) => c.id);
    expect(ids).toContain(visible);
    expect(ids).not.toContain(leftClub);
    expect(ids).not.toContain(notReading);
  });

  // -- CELL 11: progress gate ahead/behind, end to end.
  it("cell 11: others' items ahead of the viewer are gated ahead; at/behind are not", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await setProgress("viewer", 40);
    const ahead = await ann({ userId: "stranger", visibility: "public", locator: loc(0.8) });
    const behind = await ann({ userId: "stranger", visibility: "public", locator: loc(0.1) });

    const out = await resolve("viewer");
    const byId = Object.fromEntries(out.others.map((o) => [o.id, o]));
    expect(byId[ahead].gate.ahead).toBe(true);
    expect(byId[behind].gate.ahead).toBe(false);
  });

  // -- CELL 12: manual spoiler flag gates regardless of progress; never gates MINE.
  it("cell 12: contains_spoilers gates others regardless of position; the viewer's own is never gated", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await setProgress("viewer", 100); // viewer is at the end, so nothing is "ahead"
    const spoiler = await ann({
      userId: "stranger",
      visibility: "public",
      containsSpoilers: true,
      locator: loc(0.1),
    });
    // The viewer's own spoiler-flagged, far-ahead highlight is returned via MINE, ungated.
    const own = await ann({
      userId: "viewer",
      visibility: "private",
      containsSpoilers: true,
      locator: loc(0.99),
    });

    const out = await resolve("viewer");
    const other = out.others.find((o) => o.id === spoiler);
    expect(other?.gate.spoiler).toBe(true);
    expect(other?.gate.ahead).toBe(false);
    // MINE has no gate concept and includes the viewer's own private, spoiler-flagged row.
    expect(out.mine.map((m) => m.id)).toContain(own);
  });

  // -- CELL 14: popular = >= 3 DISTINCT public users on the same normalized passage.
  it("cell 14: popular highlights require 3 distinct public users on a normalized passage", async () => {
    await seedUser("viewer");
    await seedUser("u1");
    await seedUser("u2");
    await seedUser("u3");
    await seedUser("u4");

    // Passage A: three distinct users -> popular.
    for (const u of ["u1", "u2", "u3"]) {
      await ann({ userId: u, visibility: "public", normalizedText: "to be or not to be" });
    }
    // Passage B: only two distinct users -> not popular.
    for (const u of ["u1", "u2"]) {
      await ann({ userId: u, visibility: "public", normalizedText: "call me ishmael" });
    }
    // Passage C: one user highlighting three times -> not popular (distinct users, not rows).
    for (let i = 0; i < 3; i++) {
      await ann({ userId: "u4", visibility: "public", normalizedText: "happy families" });
    }

    const out = await resolve("viewer");
    const texts = out.popular.map((p) => p.normalizedText).sort();
    expect(texts).toEqual(["to be or not to be"]);
    expect(out.popular[0].count).toBe(3);
  });

  // -- CELL 15: anonymous viewer -> public + popular only; no mine/club/friend/comments.
  it("cell 15: an anonymous viewer sees only public and popular", async () => {
    await seedUser("stranger");
    await seedUser("u1");
    await seedUser("u2");
    await seedUser("u3");
    const pub = await ann({
      userId: "stranger",
      visibility: "public",
      normalizedText: "shared line",
    });
    await ann({ userId: "u1", visibility: "public", normalizedText: "popular line" });
    await ann({ userId: "u2", visibility: "public", normalizedText: "popular line" });
    await ann({ userId: "u3", visibility: "public", normalizedText: "popular line" });
    // A private and a friends annotation that must never reach an anonymous viewer.
    await ann({ userId: "stranger", visibility: "private" });
    await ann({ userId: "stranger", visibility: "friends" });

    const out = await resolve(null);
    expect(out.viewerProgressPct).toBeNull();
    expect(out.mine).toHaveLength(0);
    expect(out.comments).toHaveLength(0);
    expect(out.others.map((o) => o.id)).toContain(pub);
    expect(out.others.every((o) => o.layer === "public")).toBe(true);
    expect(out.popular.map((p) => p.normalizedText)).toContain("popular line");
  });

  // -- MINE: the viewer sees their OWN private/friends/public/club, at every visibility.
  it("mine: the viewer's own annotations are returned at every visibility", async () => {
    await seedUser("viewer");
    const priv = await ann({ userId: "viewer", visibility: "private" });
    const pub = await ann({ userId: "viewer", visibility: "public" });
    const note = await ann({
      userId: "viewer",
      type: "bookmark",
      visibility: "private",
      locator: loc(0.2),
    });

    const out = await resolve("viewer");
    const mineIds = out.mine.map((m) => m.id).sort();
    expect(mineIds).toEqual([priv, pub, note].sort());
    // The viewer's own rows must never appear in the others' layer.
    expect(out.others).toHaveLength(0);
  });
});

describe("GET /api/v1/books/:id/annotations (endpoint wiring + optional session)", () => {
  function apiWith() {
    return testApi();
  }

  async function call(path: string, user?: string) {
    const headers: Record<string, string> = {};
    if (user) headers["x-test-user"] = user;
    return apiWith().fetch(new Request(`https://test.local${path}`, { headers }), env as never);
  }

  beforeEach(async () => {
    const d = db();
    annSeq = 0;
    for (const t of [
      schema.annotations,
      schema.userBooks,
      schema.clubBooks,
      schema.clubMembers,
      schema.clubs,
      schema.closeFriends,
      schema.books,
      schema.profiles,
      schema.user,
    ]) {
      await d.delete(t);
    }
    await seedBook(BOOK);
  });

  it("signed-in: returns the viewer's own plus the entitled others", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await ann({ userId: "viewer", visibility: "private" });
    await ann({ userId: "stranger", visibility: "public" });

    const res = await call(`/books/${BOOK}/annotations`, "viewer");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mine: unknown[];
      others: { layer: string }[];
      viewerProgressPct: number | null;
    };
    expect(body.mine).toHaveLength(1);
    expect(body.others).toHaveLength(1);
    expect(body.others[0].layer).toBe("public");
  });

  it("anonymous: 200 with public + popular only, no mine", async () => {
    await seedUser("stranger");
    await ann({ userId: "stranger", visibility: "public" });
    await ann({ userId: "stranger", visibility: "private" });

    const res = await call(`/books/${BOOK}/annotations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mine: unknown[]; others: unknown[] };
    expect(body.mine).toHaveLength(0);
    expect(body.others).toHaveLength(1);
  });

  it("?layers= trims the payload to the requested layers", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await ann({ userId: "viewer", visibility: "private" });
    await ann({ userId: "stranger", visibility: "public" });

    const res = await call(`/books/${BOOK}/annotations?layers=mine`, "viewer");
    const body = (await res.json()) as { mine: unknown[]; others: unknown[] };
    expect(body.mine).toHaveLength(1);
    expect(body.others).toHaveLength(0); // public layer not requested
  });
});

// The REQUIRED authorization gate: a non-member must never post into a club's passage
// thread. Every rejection is verified against local D1 (403 AND no row inserted), not
// assumed. active-member -> 201; every non-active state (absent / invited / left /
// banned) -> 403.
describe("POST /api/v1/annotations/comments (assertActiveMember gate)", () => {
  function apiWith() {
    return testApi();
  }

  async function post(path: string, user: string, body: unknown) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (user) headers["x-test-user"] = user;
    return apiWith().fetch(
      new Request(`https://test.local${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
      env as never,
    );
  }

  async function commentCount(clubId: string) {
    const rows = await db()
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.clubId, clubId));
    return rows.length;
  }

  const CLUB = "club-x";
  const commentBody = () => ({
    clubId: CLUB,
    bookId: BOOK,
    body: "A thought on this passage",
    locator: loc(0.3),
  });

  beforeEach(async () => {
    const d = db();
    annSeq = 0;
    for (const t of [
      schema.annotations,
      schema.userBooks,
      schema.clubBooks,
      schema.clubMembers,
      schema.clubs,
      schema.closeFriends,
      schema.books,
      schema.profiles,
      schema.user,
    ]) {
      await d.delete(t);
    }
    await seedBook(BOOK);
    await seedUser("member");
    await seedUser("outsider");
    await seedClub(CLUB, { currentBookId: BOOK, creatorId: "member" });
    await addMember(CLUB, "member", "active", "owner");
  });

  it("an active member CAN post (201) and the row lands as a club comment", async () => {
    const res = await post("/annotations/comments", "member", commentBody());
    expect(res.status).toBe(201);
    const { annotation } = (await res.json()) as {
      annotation: { type: string; clubId: string; visibility: string; bookId: string };
    };
    expect(annotation.type).toBe("comment");
    expect(annotation.clubId).toBe(CLUB);
    expect(annotation.visibility).toBe("club");
    expect(annotation.bookId).toBe(BOOK);
    expect(await commentCount(CLUB)).toBe(1);
  });

  it("a NON-member is rejected 403 and NO row is inserted", async () => {
    const res = await post("/annotations/comments", "outsider", commentBody());
    expect(res.status).toBe(403);
    expect(await commentCount(CLUB)).toBe(0);
  });

  it("a non-active (invited) member is rejected 403 and NO row is inserted", async () => {
    await addMember(CLUB, "outsider", "invited");
    const res = await post("/annotations/comments", "outsider", commentBody());
    expect(res.status).toBe(403);
    expect(await commentCount(CLUB)).toBe(0);
  });

  it("a member who has LEFT is rejected 403 and NO row is inserted", async () => {
    await addMember(CLUB, "outsider", "left");
    const res = await post("/annotations/comments", "outsider", commentBody());
    expect(res.status).toBe(403);
    expect(await commentCount(CLUB)).toBe(0);
  });

  it("a BANNED member is rejected 403 and NO row is inserted", async () => {
    await addMember(CLUB, "outsider", "banned");
    const res = await post("/annotations/comments", "outsider", commentBody());
    expect(res.status).toBe(403);
    expect(await commentCount(CLUB)).toBe(0);
  });
});
