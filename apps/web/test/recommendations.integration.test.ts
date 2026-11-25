import { env } from "cloudflare:test";
import { createDb, getRecommendations, schema } from "@foxing/core";
import type { StructuredCaller } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "./test-api";

const db = () => createDb(env.DB);

function stubCaller(value: unknown): StructuredCaller {
  const none = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 };
  return async () => ({ value, usage: { ...none, input: 20, output: 40, long: { ...none } } });
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
    for (let i = 0; i < 12; i++) {
      await seedBook({ id: `b${i}`, rating: 2 + (i % 4), ratingCount: 5 + i });
    }
    await seedBook({
      id: "shelley-extra",
      author: "Mary Shelley",
      subjects: ["Gothic"],
      rating: 3,
    });
    await seedBook({ id: "no-epub", epub: false });
    await seedBook({ id: "community", sourceType: "community" });
  });

  it("returns a full data page for a zero-history free reader (no AI, no crash)", async () => {
    await seedUser("zero", "free", { favoriteGenres: null });
    const set = await getRecommendations(db(), "zero", { caller: null, kv: env.APP_KV });

    expect(set.isPlus).toBe(false);
    expect(set.aiPersonalized).toBe(false);
    expect(set.recommendations.length).toBeGreaterThan(0);
    const ids = set.recommendations.map((r) => r.bookId);
    expect(ids).not.toContain("no-epub");
    expect(ids).not.toContain("community");
    expect(set.recommendations.every((r) => r.reason.length > 0)).toBe(true);
  });

  it("never recommends a book already in the reader's library (any status)", async () => {
    await seedUser("owner", "free", { favoriteGenres: null });
    await db().insert(schema.userBooks).values({
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
    await seedUser("hist", "free", { favoriteGenres: null });
    await db().insert(schema.userBooks).values({
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
    expect(set.recommendations.map((r) => r.bookId)).not.toContain("b0");
  });
});

describe("getRecommendations - null genres + large pool (D1 param-cap regression)", () => {
  // Local D1 does not enforce the 100-bound-variable cap, so this cannot reproduce the original
  // "too many SQL variables" throw; it drives the multi-chunk award lookup and checks the chunks dedupe.
  beforeEach(async () => {
    await clearAll();
    for (let i = 0; i < 250; i++) {
      await seedBook({
        id: `p${String(i).padStart(3, "0")}`,
        rating: 2 + (i % 4),
        ratingCount: 1 + i,
      });
    }
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
    await seedUser("newbie", "free", { favoriteGenres: null });
    const set = await getRecommendations(db(), "newbie", { caller: null, kv: env.APP_KV });

    expect(set.isPlus).toBe(false);
    expect(set.aiPersonalized).toBe(false);
    expect(set.recommendations.length).toBe(16);
    expect(set.recommendations.every((r) => r.reason.length > 0)).toBe(true);
    expect(set.recommendations.some((r) => r.reason.startsWith("Award winner"))).toBe(true);
  });
});

describe("getRecommendations - AI tier (Plus, stubbed)", () => {
  beforeEach(async () => {
    await clearAll();
    for (let i = 0; i < 10; i++) {
      await seedBook({ id: `b${i}`, rating: 3 + (i % 2), ratingCount: 10 + i });
    }
    await env.APP_KV.delete("recs:plus-ok");
    await env.APP_KV.delete("recs:plus-bad");
    await env.APP_KV.delete("recs-refresh:plus-ok");
    await env.APP_KV.delete("recs-refresh:plus-bad");
  });

  it("uses the AI selection + reasons when the model returns valid JSON, and a data reason for one that fails the prose check", async () => {
    await seedUser("plus-ok", "plus", { favoriteGenres: ["Gothic"] });
    const selection = {
      picks: Array.from({ length: 8 }, (_, i) => ({
        book_id: `b${i}`,
        reason: i === 1 ? "As an AI language model, I cannot pick books" : `AI reason ${i}`,
      })),
    };
    const set = await getRecommendations(db(), "plus-ok", {
      caller: stubCaller(selection),
      kv: env.APP_KV,
    });

    expect(set.isPlus).toBe(true);
    expect(set.aiPersonalized).toBe(true);
    expect(set.recommendations[0].reason).toBe("AI reason 0");
    // A reason that fails the prose check never reaches the reader.
    const second = set.recommendations.find((r) => r.bookId === "b1");
    expect(second?.reason).toBeTruthy();
    expect(second?.reason).not.toContain("language model");
  });

  it("falls back to the data ranking silently when the model call fails", async () => {
    await seedUser("plus-bad", "plus", { favoriteGenres: ["Gothic"] });
    const set = await getRecommendations(db(), "plus-bad", {
      caller: async () => {
        throw new Error("The model call did not finish (invalid_output).");
      },
      kv: env.APP_KV,
    });

    expect(set.isPlus).toBe(true);
    expect(set.aiPersonalized).toBe(false);
    expect(set.recommendations.length).toBeGreaterThan(0);
  });
});
