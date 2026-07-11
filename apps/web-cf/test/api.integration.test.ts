import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { billing, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

// A stub session resolver: the Worker normally injects a Better Auth-backed one.
// Here the test sets an x-test-user header to act as that user.
const api = createApi({
  resolveSession: async (req) => {
    const id = req.headers.get("x-test-user");
    return id ? { id, email: `${id}@example.com` } : null;
  },
  // This suite never calls /companion; a stub that errors if invoked is enough to
  // satisfy ApiDeps without a network call or a key.
  resolveCompanionCaller: () =>
    // biome-ignore lint/correctness/useYield: throws on first iteration by design, never yields
    async function* unused() {
      throw new Error("not used in this suite");
    },
  // Not used in this suite; the not-configured stub satisfies ApiDeps without keys.
  resolveBilling: () => ({
    client: billing.notConfiguredBilling(),
    prices: { monthly: "", annual: "" },
  }),
});

// The bare api app serves routes at the root (/me, /u/:username); the Worker mounts
// it under /api/v1. Tests call it directly, so no prefix here.
const call = (pathname: string, init?: RequestInit) =>
  api.fetch(new Request(`https://test.local${pathname}`, init), env as never);

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
}

describe("profiles API (web -> api -> core -> D1)", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.activityEvents);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
  });

  it("returns 401 for GET /me without a session", async () => {
    const res = await call("/me");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("round-trips a profile through core to D1", async () => {
    await seedUser("u_round");
    const db = createDb(env.DB);
    await db.insert(schema.profiles).values({
      id: "u_round",
      username: "roundtrip",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await call("/me", { headers: { "x-test-user": "u_round" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: { username: string } };
    expect(body.profile.username).toBe("roundtrip");
  });

  it("onboards a user through the API contract (201)", async () => {
    await seedUser("u_ob");
    const res = await call("/me/onboard", {
      method: "POST",
      headers: { "x-test-user": "u_ob", "content-type": "application/json" },
      body: JSON.stringify({ username: "onboarded" }),
    });
    expect(res.status).toBe(201);
    // The profile.onboarded emission is a D1 side effect; it is verified at the core
    // layer and by Fable's independent D1 check, not by asserting rows here.
  });

  it("rejects a duplicate username with 409", async () => {
    await seedUser("u_a");
    await seedUser("u_b");
    const db = createDb(env.DB);
    await db.insert(schema.profiles).values({
      id: "u_a",
      username: "taken",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await call("/me/onboard", {
      method: "POST",
      headers: { "x-test-user": "u_b", "content-type": "application/json" },
      body: JSON.stringify({ username: "taken" }),
    });
    expect(res.status).toBe(409);
  });

  it("persists visibility prefs through PATCH /me/visibility", async () => {
    await seedUser("u_vis");
    const db = createDb(env.DB);
    await db.insert(schema.profiles).values({
      id: "u_vis",
      username: "visuser",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await call("/me/visibility", {
      method: "PATCH",
      headers: { "x-test-user": "u_vis", "content-type": "application/json" },
      body: JSON.stringify({ profile: "private", progress: "public", defaultAnnotation: "friends" }),
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select({ visibility: schema.profiles.visibility })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, "u_vis"));
    expect(row.visibility).toEqual({
      profile: "private",
      progress: "public",
      defaultAnnotation: "friends",
    });
  });

  it("rejects an invalid visibility value", async () => {
    await seedUser("u_vis2");
    const db = createDb(env.DB);
    await db.insert(schema.profiles).values({
      id: "u_vis2",
      username: "visuser2",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await call("/me/visibility", {
      method: "PATCH",
      headers: { "x-test-user": "u_vis2", "content-type": "application/json" },
      body: JSON.stringify({ profile: "everyone" }),
    });
    expect(res.status).toBe(422);
  });
});
