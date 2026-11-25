import { env } from "cloudflare:test";
import { createDb, push, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

const db = () => createDb(env.DB);

// 15:00 UTC is 10:00 in New York.
const NOON_ISH = Date.UTC(2026, 0, 15, 15, 0, 0);

async function seed(opts: {
  timezone?: string | null;
  prefs?: unknown;
  tokens: string[];
  notifType: string;
}) {
  const d = db();
  await d.insert(schema.user).values({
    id: "u1",
    name: "u1",
    email: "u1@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await d.insert(schema.profiles).values({
    id: "u1",
    username: "u1",
    subscriptionTier: "free",
    timezone: opts.timezone ?? "America/New_York",
    notificationPrefs: (opts.prefs as never) ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  for (const t of opts.tokens) {
    await d
      .insert(schema.pushTokens)
      .values({ userId: "u1", token: t, platform: "ios", createdAt: new Date() });
  }
  const [n] = await d
    .insert(schema.notifications)
    .values({
      userId: "u1",
      type: opts.notifType,
      title: "Hi",
      body: "there",
      createdAt: new Date(),
    })
    .returning();
  return n.id;
}

// Stub Expo: one ticket per message, in request order; a token containing "dead" is DeviceNotRegistered.
function stubFetch(): { fetchImpl: typeof fetch; calls: number } {
  const state = { calls: 0 };
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    state.calls++;
    const batch = JSON.parse(String(init?.body ?? "[]")) as Array<{ to: string }>;
    const data = batch.map((m) =>
      m.to.includes("dead")
        ? { status: "error", details: { error: "DeviceNotRegistered" } }
        : { status: "ok", id: "r1" },
    );
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    get calls() {
      return state.calls;
    },
  };
}

describe("push delivery (core -> local D1, stub Expo)", () => {
  beforeEach(async () => {
    const d = db();
    for (const t of [schema.pushTokens, schema.notifications, schema.profiles, schema.user]) {
      await d.delete(t);
    }
  });

  it("delivers to live tokens and prunes DeviceNotRegistered", async () => {
    const id = await seed({
      tokens: ["ExponentPushToken[live]", "ExponentPushToken[dead]"],
      notifType: "post_reply",
    });
    const stub = stubFetch();
    const res = await push.deliverPush(db(), { fetchImpl: stub.fetchImpl, nowUtcMs: NOON_ISH }, id);
    expect(res).toMatchObject({ delivered: 1, pruned: 1, reason: "ok" });

    const remaining = await db()
      .select()
      .from(schema.pushTokens)
      .where(eq(schema.pushTokens.userId, "u1"));
    expect(remaining.map((t) => t.token)).toEqual(["ExponentPushToken[live]"]);
  });

  it.each([
    [
      "category_off",
      { prefs: { categories: { club_replies: false } }, tokens: ["ExponentPushToken[x]"] },
    ],
    [
      "quiet_hours",
      { prefs: { quietHours: { start: "09:00", end: "11:00" } }, tokens: ["ExponentPushToken[x]"] },
    ],
    ["no_tokens", { tokens: [] }],
  ])("sends nothing and reports %s", async (reason, opts) => {
    const id = await seed({ ...opts, notifType: "post_reply" });
    const stub = stubFetch();
    const res = await push.deliverPush(db(), { fetchImpl: stub.fetchImpl, nowUtcMs: NOON_ISH }, id);
    expect(res.reason).toBe(reason);
    expect(res.delivered).toBe(0);
    expect(stub.calls).toBe(0);
  });
});
