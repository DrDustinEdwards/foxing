import { env } from "cloudflare:test";
import { createDb, loadReaderAnnotations, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { seedUser, testApi } from "./test-api";

// The reader social-layer matrix against local D1, so the entitlement is proven in the SQL. MINE is the only branch
// without a visibility filter (hard-scoped to the viewer); every other branch needs another user, a non-private
// visibility and an entitled author/club set, so others' private never leaks. The club passage layer follows the
// CURRENT read only: a finished club_books row does not keep it alive.

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

async function addPastClubBook(clubId: string, bookId: string) {
  await db()
    .insert(schema.clubBooks)
    .values({
      id: `${clubId}-${bookId}`,
      clubId,
      bookId,
      startedAt: new Date(),
      finishedAt: new Date(),
    });
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

async function resetTables() {
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
    await db().delete(t);
  }
}

describe("reader social-layer resolution matrix (local D1)", () => {
  beforeEach(async () => {
    await resetTables();
    await seedBook(BOOK);
    await seedBook(OTHER_BOOK);
  });

  it("others' PRIVATE annotations never appear (club-mate, close friend, stranger)", async () => {
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

  it("a stranger's PUBLIC annotation is returned, layer=public", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    const id = await ann({ userId: "stranger", visibility: "public" });

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(1);
    expect(out.others[0].id).toBe(id);
    expect(out.others[0].layer).toBe("public");
    expect(out.others[0].author.id).toBe("stranger");
  });

  it("a co-reader's CLUB annotation (shared current read) is returned, layer=club", async () => {
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

  it("a CLUB annotation is NOT returned when the club is not reading this book, the viewer is not an active member, or the author left", async () => {
    await seedUser("viewer");
    await seedUser("notreading");
    await seedUser("owner5");
    await seedUser("author");
    // The club's current read is another book; its only row for this one is a finished past read.
    await seedClub("c2", { currentBookId: OTHER_BOOK, creatorId: "viewer" });
    await addMember("c2", "viewer", "active", "owner");
    await addMember("c2", "notreading", "active");
    await addPastClubBook("c2", BOOK);
    await ann({ userId: "notreading", visibility: "club" });
    // The viewer is invited, not active.
    await seedClub("c3", { currentBookId: BOOK, creatorId: "owner5" });
    await addMember("c3", "owner5", "active", "owner");
    await addMember("c3", "viewer", "invited");
    await ann({ userId: "owner5", visibility: "club" });
    // The author has left.
    await seedClub("c4", { currentBookId: BOOK, creatorId: "viewer" });
    await addMember("c4", "viewer", "active", "owner");
    await addMember("c4", "author", "left");
    await ann({ userId: "author", visibility: "club" });

    expect((await resolve("viewer")).others).toHaveLength(0);
  });

  it("a close friend's FRIENDS annotation is returned, layer=friend", async () => {
    await seedUser("viewer");
    await seedUser("friend");
    await addCloseFriend("friend", "viewer");
    const id = await ann({ userId: "friend", visibility: "friends" });

    const out = await resolve("viewer");
    expect(out.others.map((o) => o.id)).toEqual([id]);
    expect(out.others[0].layer).toBe("friend");
  });

  it("a FRIENDS annotation from someone who did NOT add the viewer is NOT returned", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await ann({ userId: "stranger", visibility: "friends" });
    // The reverse direction does not count.
    await addCloseFriend("viewer", "stranger");

    const out = await resolve("viewer");
    expect(out.others).toHaveLength(0);
  });

  it("an author in two shared current-read clubs yields the annotation ONCE", async () => {
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

  it("passage comments surface only for active clubs currently reading the book", async () => {
    await seedUser("viewer");
    await seedUser("clubmate");

    await seedClub("c1", { currentBookId: BOOK, creatorId: "viewer" });
    await addMember("c1", "viewer", "active", "owner");
    await addMember("c1", "clubmate", "active");
    const visible = await ann({
      userId: "clubmate",
      type: "comment",
      clubId: "c1",
      visibility: "club",
    });

    await seedClub("c6", { currentBookId: BOOK, creatorId: "clubmate" });
    await addMember("c6", "clubmate", "active", "owner");
    await addMember("c6", "viewer", "left");
    const leftClub = await ann({
      userId: "clubmate",
      type: "comment",
      clubId: "c6",
      visibility: "club",
    });

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

  it("others' items ahead of the viewer are gated ahead; at/behind are not", async () => {
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

  it("contains_spoilers gates others regardless of position; the viewer's own is never gated", async () => {
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

  it("popular highlights require 3 distinct public users on a normalized passage", async () => {
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

  it("an anonymous viewer sees only public and popular", async () => {
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
    await resetTables();
    await seedBook(BOOK);
  });

  it("signed-in: returns the viewer's own plus the entitled others, and ?layers= trims to those requested", async () => {
    await seedUser("viewer");
    await seedUser("stranger");
    await ann({ userId: "viewer", visibility: "private" });
    await ann({ userId: "stranger", visibility: "public" });
    type Body = { mine: unknown[]; others: { layer: string }[] };

    const res = await call(`/books/${BOOK}/annotations`, "viewer");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.mine).toHaveLength(1);
    expect(body.others.map((o) => o.layer)).toEqual(["public"]);

    const trimmed = (await (
      await call(`/books/${BOOK}/annotations?layers=mine`, "viewer")
    ).json()) as Body;
    expect(trimmed.mine).toHaveLength(1);
    expect(trimmed.others).toHaveLength(0);
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
});

// A non-member must never post into a club's passage thread: 403 and no row inserted.
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
    await resetTables();
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

  it("a non-member, an invited member, one who left and a banned one are each rejected 403 with no row inserted", async () => {
    const states = ["invited", "left", "banned"] as const;
    for (const status of states) {
      await seedUser(status);
      await addMember(CLUB, status, status);
    }
    for (const user of ["outsider", ...states]) {
      const res = await post("/annotations/comments", user, commentBody());
      expect(res.status, user).toBe(403);
    }
    expect(await commentCount(CLUB)).toBe(0);
  });
});
