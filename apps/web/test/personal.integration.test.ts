import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { billing, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { legacyRedirectTarget } from "../app/lib/redirects";

// Personal surfaces + the three cut features. The cut redirects are a pure function
// (unit-tested here); the goal-edit contract drives the API directly (x-test-user stands
// in for the Better Auth session the Worker injects). The visible /diary, /goals, and
// /year UI are covered by the Playwright authed spec with the real login fixture.

describe("cut-feature redirects (one hop to the nearest live surface)", () => {
  it("collapses series, quotes, and buddy-reads onto their targets", () => {
    expect(legacyRedirectTarget("/series")).toBe("/books");
    expect(legacyRedirectTarget("/series/dune")).toBe("/books");
    expect(legacyRedirectTarget("/quotes")).toBe("/journal");
    expect(legacyRedirectTarget("/quotes/123")).toBe("/journal");
    expect(legacyRedirectTarget("/buddy-reads")).toBe("/clubs");
    expect(legacyRedirectTarget("/buddy-reads/abc")).toBe("/clubs");
  });

  it("never points a cut target at another redirect (no chains)", () => {
    for (const p of ["/books", "/journal", "/clubs"]) {
      expect(legacyRedirectTarget(p)).toBeNull();
    }
  });
});

const api = createApi({
  resolveSession: async (req) => {
    const id = req.headers.get("x-test-user");
    return id ? { id, email: `${id}@example.com` } : null;
  },
  resolveCompanionCaller: () =>
    // biome-ignore lint/correctness/useYield: throws on first iteration by design, never yields
    async function* unused() {
      throw new Error("not used in this suite");
    },
  resolveBilling: () => ({
    client: billing.notConfiguredBilling(),
    prices: { monthly: "", annual: "" },
  }),
});

const call = (pathname: string, user: string | null, init?: RequestInit) =>
  api.fetch(
    new Request(`https://test.local${pathname}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(user ? { "x-test-user": user } : {}),
        ...(init?.headers ?? {}),
      },
    }),
    env as never,
  );

async function seedUser(id: string) {
  const db = createDb(env.DB);
  await db.insert(schema.user).values({
    id,
    name: "Test",
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.profiles).values({
    id,
    username: id,
    displayName: id,
    onboardedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("reading goal edit", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.readingGoals);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("reader");
  });

  it("retargets a goal the caller owns and reflects it", async () => {
    const created = await call("/goals", "reader", {
      method: "POST",
      body: JSON.stringify({ type: "books", target: 12, periodType: "year", year: 2026 }),
    });
    expect(created.status).toBe(201);
    const { goal } = (await created.json()) as { goal: { id: string } };

    const patched = await call(`/goals/${goal.id}`, "reader", {
      method: "PATCH",
      body: JSON.stringify({ target: 24 }),
    });
    expect(patched.status).toBe(200);

    const db = createDb(env.DB);
    const [row] = await db
      .select({ target: schema.readingGoals.target })
      .from(schema.readingGoals)
      .where(eq(schema.readingGoals.id, goal.id));
    expect(row?.target).toBe(24);
  });

  it("will not retarget a goal owned by someone else", async () => {
    await seedUser("other");
    const created = await call("/goals", "other", {
      method: "POST",
      body: JSON.stringify({ type: "books", target: 5, periodType: "year", year: 2026 }),
    });
    const { goal } = (await created.json()) as { goal: { id: string } };

    const res = await call(`/goals/${goal.id}`, "reader", {
      method: "PATCH",
      body: JSON.stringify({ target: 99 }),
    });
    expect(res.status).toBe(404);
  });
});
