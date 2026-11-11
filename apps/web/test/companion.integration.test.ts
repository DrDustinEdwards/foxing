import { env } from "cloudflare:test";
import { COMPANION_QUOTA, type companion, companionRepo, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { testApi } from "./test-api";

// Companion route: API-contract layer only (status codes, SSE stream shape), tested
// through a forged x-test-user session -- the same accepted pattern as
// api.integration.test.ts. This proves the ROUTE's gating and wiring, not that the
// product works end to end; it never asserts D1 rows through the forged session.
// Repository behavior (actual D1 read/write) is tested separately below by calling
// companionRepo functions directly, which is not a forged session.

function stubCaller(text = "Hello, reader."): companion.CompanionCaller {
  return async function* stub() {
    yield { type: "text", delta: text };
    const none = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 };
    yield { type: "done", usage: { ...none, input: 42, output: 7, long: { ...none } } };
  };
}

function throwingCaller(): companion.CompanionCaller {
  // oxlint-disable-next-line eslint/require-yield -- throws on first iteration by design, never yields
  return async function* boom() {
    throw new Error("model call failed");
  };
}

const db = () => createDb(env.DB);

async function seedUserAndProfile(id: string, tier: "free" | "plus" = "free") {
  const d = db();
  await d.insert(schema.user).values({
    id,
    name: "Test",
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await d.insert(schema.profiles).values({
    id,
    username: id,
    subscriptionTier: tier,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedBook(): Promise<string> {
  const d = db();
  const [row] = await d
    .insert(schema.books)
    .values({
      slug: `companion-test-${crypto.randomUUID()}`,
      title: "Pride and Prejudice",
      author: "Jane Austen",
      source: "gutenberg",
      sourceType: "catalog",
      language: "en",
      description: "A comedy of manners.",
      publicationYear: 1813,
    })
    .returning({ id: schema.books.id });
  return row.id;
}

describe("companion repository (direct core calls, local D1)", () => {
  it("creates one thread per (user, book) and appends messages in order", async () => {
    const bookId = await seedBook();
    await seedUserAndProfile("u_thread", "plus");

    const first = await companionRepo.getOrCreateThread(db(), "u_thread", bookId);
    const second = await companionRepo.getOrCreateThread(db(), "u_thread", bookId);
    expect(second.id).toBe(first.id);

    await companionRepo.appendMessage(db(), first.id, "user", "Hello");
    await companionRepo.appendMessage(db(), first.id, "assistant", "Hi there");
    const recent = await companionRepo.listRecentMessages(db(), first.id, 10);
    expect(recent.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("upserts a cached action and reads it back", async () => {
    const bookId = await seedBook();
    await companionRepo.upsertCachedAction(
      db(),
      bookId,
      "book_description",
      "First draft.",
      "claude-sonnet-5",
    );
    await companionRepo.upsertCachedAction(
      db(),
      bookId,
      "book_description",
      "Revised.",
      "claude-sonnet-5",
    );
    const row = await companionRepo.getCachedAction(db(), bookId, "book_description");
    expect(row?.content).toBe("Revised.");
  });
});

describe("companion route (forged x-test-user session, API-contract layer)", () => {
  beforeEach(async () => {
    const d = db();
    await d.delete(schema.companionUsage);
    await d.delete(schema.companionMessages);
    await d.delete(schema.companionThreads);
    await d.delete(schema.profiles);
    await d.delete(schema.user);
    await d.delete(schema.books);
  });

  function apiWith(caller: companion.CompanionCaller) {
    return testApi({
      resolveCompanionCaller: () => caller,
    });
  }

  const call = async (api: ReturnType<typeof apiWith>, userId: string, body: unknown) =>
    api.fetch(
      new Request("https://test.local/companion", {
        method: "POST",
        headers: { "x-test-user": userId, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env as never,
    );

  it("rejects a free-tier user with 403 plus_required", async () => {
    const bookId = await seedBook();
    await seedUserAndProfile("u_free", "free");
    const res = await call(apiWith(stubCaller()), "u_free", {
      action: "chat",
      bookId,
      message: "hi",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("plus_required");
  });

  it("streams a response for a plus-tier user under quota", async () => {
    const bookId = await seedBook();
    await seedUserAndProfile("u_plus", "plus");
    const res = await call(apiWith(stubCaller("The companion's answer.")), "u_plus", {
      action: "chat",
      bookId,
      message: "What do you think of Mr. Darcy?",
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("The companion's answer.");
    expect(text).toContain("event: done");
  });

  it("reserves quota before the model call: parallel requests cannot all pass the cap, and a failed reply still counts", async () => {
    const bookId = await seedBook();
    await seedUserAndProfile("u_over", "plus");
    const usage = () =>
      db()
        .select()
        .from(schema.companionUsage)
        .where(eq(schema.companionUsage.userId, "u_over"))
        .then((rows) => rows[0]);

    // A failed reply keeps its worst-case reservation: the model may have been billed for it.
    const failed = await call(apiWith(throwingCaller()), "u_over", {
      action: "chat",
      bookId,
      message: "hi",
    });
    await failed.text();
    const afterFailure = await usage();
    expect(afterFailure.requests).toBe(1);
    expect(afterFailure.costCents).toBeGreaterThan(0);

    // One cent under the ceiling: of five requests sent at once, only the first reservation fits.
    await db()
      .update(schema.companionUsage)
      .set({ costCents: COMPANION_QUOTA.dailyCostCeilingCents - 1 })
      .where(eq(schema.companionUsage.userId, "u_over"));
    const api = apiWith(stubCaller());
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        call(api, "u_over", { action: "chat", bookId, message: "hi" }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 429, 429, 429, 429]);
    const refused = (await results.find((r) => r.status === 429)?.json()) as {
      error: { code: string; details?: { resets_at?: string } };
    };
    expect(refused.error.code).toBe("quota");
    expect(refused.error.details?.resets_at).toBeTruthy();
    await Promise.all(results.map((r) => r.text().catch(() => "")));
    expect((await usage()).requests).toBe(2);
  });

  it("surfaces a stream failure as a visible SSE error event, not a silent drop", async () => {
    const bookId = await seedBook();
    await seedUserAndProfile("u_err", "plus");
    const res = await call(apiWith(throwingCaller()), "u_err", {
      action: "chat",
      bookId,
      message: "hi",
    });
    expect(res.status).toBe(200); // headers already sent before the model call failed
    const text = await res.text();
    expect(text).toContain("event: error");
  });

  it("rejects an unknown or cached-only action name at the validation boundary", async () => {
    const bookId = await seedBook();
    await seedUserAndProfile("u_val", "plus");
    const res = await call(apiWith(stubCaller()), "u_val", {
      action: "book_description", // a free-cached action, never accepted here
      bookId,
    });
    expect(res.status).toBe(422);
  });
});
