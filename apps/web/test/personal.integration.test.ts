import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { seedUser, testApi } from "./test-api";

// Personal surfaces. The goal-edit contract drives the API directly (x-test-user stands
// in for the Better Auth session the Worker injects). The visible /diary, /goals, and
// /year UI are covered by the Playwright authed spec with the real login fixture.

const api = testApi();

const call = (pathname: string, user: string | null, init?: RequestInit) =>
  api.fetch(
    new Request(`https://test.local${pathname}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(user ? { "x-test-user": user } : {}),
        ...Object.fromEntries(new Headers(init?.headers)),
      },
    }),
    env as never,
  );

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
