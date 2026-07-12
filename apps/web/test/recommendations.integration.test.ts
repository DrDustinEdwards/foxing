import { env } from "cloudflare:test";
import { createDb, getRecommendations, schema } from "@foxing/core";
import type { CompanionCaller } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

// getRecommendations end to end against local D1 (real migrations) + the real miniflare
// KV. The AI tier is exercised with a stubbed caller (no network): one that returns a
// valid selection (personalised) and one that returns garbage (silent fallback to the
// data ranking). Free/zero-history and with-history both return a full data page.

const db = () => createDb(env.DB);

// A caller that emits `text` as one chunk then a done event. No network.
function stubCaller(text: string): CompanionCaller {
  return async function* () {
    yield { type: "text", delta: text } as const;
    yield { type: "done", inputTokens: 20, outputTokens: 40 } as const;
  };
}

async function seedUser(id: string, tier: "free" | "plus", favoriteGenres: string[] | null) {
  await db()
    .insert(schema.user)
    .values({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await db()
    .insert(schema.profiles)
    .values({
      id,
      username: id,
      displayName: id,
      favoriteGenres,
      subscriptionTier: tier,
      onboardedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

interface BookSeed {
  id: string;
  author?: string;
  subjects?: string[];
  rating?: number;
  ratingCount?: number;
  epub?: boolean;
  cover?: boolean;
  sourceType?: string;
}

async function seedBook(b: BookSeed) {
  await db()
    .insert(schema.books)
    .values({
      id: b.id,
      title: `Title ${b.id}`,
      author: b.author ?? "Anon",
      slug: b.id,
      source: "test",
      sourceType: b.sourceType ?? "catalog",
      language: "en",
      epubUrl: b.epub === false ? null : `https://epub/${b.id}`,
      coverUrl: b.cover === false ? null : `https://cover/${b.id}`,
      subjects: b.subjects ?? [],
      weightedRating: b.rating ?? 3,
      ratingCount: b.ratingCount ?? 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

async function clearAll() {
  const d = db();
  await d.delete(schema.diaryEntries);
  await d.delete(schema.userBooks);
  await d.delete(schema.bookAwards);
  await d.delete(schema.books);
  await d.delete(schema.profiles);
  await d.delete(schema.user);
}

describe("getRecommendations - data tiers (no AI)", () => {
  beforeEach(async () => {
    await clearAll();
    // A small catalog: a spread of ratings, one Mary Shelley extra, one non-readable book.
    for (let i = 0; i < 12; i++) {
      await seedBook({ id: `b${i}`, rating: 2 + (i % 4), ratingCount: 5 + i });
    }
    await seedBook({ id: "shelley-extra", author: "Mary Shelley", subjects: ["Gothic"], rating: 3 });
    await seedBook({ id: "no-epub", epub: false }); // must never be a candidate
    await seedBook({ id: "community", sourceType: "community" }); // must never be a candidate
  });

  it("returns a full data page for a zero-history free reader (no AI, no crash)", async () => {
    await seedUser("zero", "free", null);
    const set = await getRecommendations(db(), "zero", { caller: null, kv: env.APP_KV });

    expect(set.isPlus).toBe(false);
    expect(set.aiPersonalized).toBe(false);
    expect(set.recommendations.length).toBeGreaterThan(0);
    // Non-readable rows are excluded from the candidate pool entirely.
    const ids = set.recommendations.map((r) => r.bookId);
    expect(ids).not.toContain("no-epub");
    expect(ids).not.toContain("community");
    // Every rec carries a reason string.
    expect(set.recommendations.every((r) => r.reason.length > 0)).toBe(true);
  });

  it("never recommends a book already in the reader's library (any status)", async () => {
    await seedUser("owner", "free", null);
    await db()
      .insert(schema.userBooks)
      .values({
        id: "ub1",
        userId: "owner",
        bookId: "b3",
        status: "want",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const set = await getRecommendations(db(), "owner", { caller: null, kv: env.APP_KV });
    expect(set.recommendations.map((r) => r.bookId)).not.toContain("b3");
  });

  it("boosts a returning author from reading history with a 'More from' reason", async () => {
    await seedUser("hist", "free", null);
    // Finished a Mary Shelley book -> she becomes a favourite author. That finished book
    // is owned (excluded); her *other* catalog book should surface with an author reason.
    await db()
      .insert(schema.userBooks)
      .values({
        id: "ub-fin",
        userId: "hist",
        bookId: "b0",
        status: "finished",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await db()
      .update(schema.books)
      .set({ author: "Mary Shelley" })
      .where(eq(schema.books.id, "b0"));

    const set = await getRecommendations(db(), "hist", { caller: null, kv: env.APP_KV });
    const shelley = set.recommendations.find((r) => r.bookId === "shelley-extra");
    expect(shelley).toBeDefined();
    expect(shelley?.reason).toContain("Mary Shelley");
    // The owned finished book never appears.
    expect(set.recommendations.map((r) => r.bookId)).not.toContain("b0");
  });
});

describe("getRecommendations - null genres + large pool (D1 param-cap regression)", () => {
  // The live 500 was listAwardWinnerIds sending a 400-id inArray, which D1 rejects at 100
  // bound vars ("too many SQL variables"). A zero-history reader's pool is exactly the
  // top-rated books, so it always hit the cap. listAwardWinnerIds now chunks the IN list.
  // NOTE: miniflare's local D1 (better-sqlite3) does NOT enforce the 100-var cap, so this
  // does not reproduce the original throw; it seeds enough books + awards to drive the
  // multi-chunk path and prove chunk results dedupe correctly for a NULL-genres user.
  beforeEach(async () => {
    await clearAll();
    // 250 readable catalog books -> the 400-cap pool spans several 90-id chunks.
    for (let i = 0; i < 250; i++) {
      await seedBook({ id: `p${String(i).padStart(3, "0")}`, rating: 2 + (i % 4), ratingCount: 1 + i });
    }
    // Awards scattered across the id range so hits land in more than one chunk.
    for (const i of [5, 95, 140, 205, 245]) {
      await db()
        .insert(schema.bookAwards)
        .values({
          id: `aw-${i}`,
          bookId: `p${String(i).padStart(3, "0")}`,
          awardSlug: "hugo",
          awardName: "Hugo",
          distinction: "winner",
          scope: "global",
          createdAt: new Date(),
        });
    }
  });

  it("returns the full starter set for a NULL favorite_genres user and never throws", async () => {
    // favorite_genres is explicitly NULL (not []), matching a brand-new profile.
    await seedUser("newbie", "free", null);
    const set = await getRecommendations(db(), "newbie", { caller: null, kv: env.APP_KV });

    expect(set.isPlus).toBe(false);
    expect(set.aiPersonalized).toBe(false);
    // A full page of starter recommendations, each with a reason.
    expect(set.recommendations.length).toBe(16);
    expect(set.recommendations.every((r) => r.reason.length > 0)).toBe(true);
    // Award winners were resolved across chunk boundaries (dedupe + multi-chunk path).
    expect(set.recommendations.some((r) => r.reason.startsWith("Award winner"))).toBe(true);
  });
});

describe("getRecommendations - AI tier (Plus, stubbed)", () => {
  beforeEach(async () => {
    await clearAll();
    for (let i = 0; i < 10; i++) {
      await seedBook({ id: `b${i}`, rating: 3 + (i % 2), ratingCount: 10 + i });
    }
    // Clear any cache from a previous run so the stub actually gets called.
    await env.APP_KV.delete("recs:plus-ok");
    await env.APP_KV.delete("recs:plus-bad");
    await env.APP_KV.delete("recs-refresh:plus-ok");
    await env.APP_KV.delete("recs-refresh:plus-bad");
  });

  it("uses the AI selection + reasons when the model returns valid JSON", async () => {
    await seedUser("plus-ok", "plus", ["Gothic"]);
    const selection = JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({
        book_id: `b${i}`,
        reason: `AI reason ${i}`,
      })),
    );
    const set = await getRecommendations(db(), "plus-ok", {
      caller: stubCaller(selection),
      kv: env.APP_KV,
    });

    expect(set.isPlus).toBe(true);
    expect(set.aiPersonalized).toBe(true);
    expect(set.recommendations[0].reason).toBe("AI reason 0");
  });

  it("falls back to the data ranking silently when the model returns garbage", async () => {
    await seedUser("plus-bad", "plus", ["Gothic"]);
    const set = await getRecommendations(db(), "plus-bad", {
      caller: stubCaller("sorry, I cannot help with that"),
      kv: env.APP_KV,
    });

    expect(set.isPlus).toBe(true);
    expect(set.aiPersonalized).toBe(false);
    expect(set.recommendations.length).toBeGreaterThan(0);
  });
});
