import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { callApi, seedUser, testApi } from "./test-api";

// Personal surfaces. The goal-edit contract drives the API directly (x-test-user stands
// in for the Better Auth session the Worker injects). The visible /diary, /goals, and
// /year UI are covered by the Playwright authed spec with the real login fixture.

const api = testApi();

const call = (path: string, user: string, req?: Omit<NonNullable<Parameters<typeof callApi>[2]>, "user">) =>
  callApi(api, path, { ...req, user });

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
      body: { type: "books", target: 12, periodType: "year", year: 2026 },
    });
    expect(created.status).toBe(201);
    const { goal } = (await created.json()) as { goal: { id: string } };

    const patched = await call(`/goals/${goal.id}`, "reader", {
      method: "PATCH",
      body: { target: 24 },
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
      body: { type: "books", target: 5, periodType: "year", year: 2026 },
    });
    const { goal } = (await created.json()) as { goal: { id: string } };

    const res = await call(`/goals/${goal.id}`, "reader", {
      method: "PATCH",
      body: { target: 99 },
    });
    expect(res.status).toBe(404);
  });
});
