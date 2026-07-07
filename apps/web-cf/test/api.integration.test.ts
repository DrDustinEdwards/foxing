import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { createDb, schema } from "@foxing/core";
import { beforeEach, describe, expect, it } from "vitest";

// A stub session resolver: the Worker normally injects a Better Auth-backed one.
// Here the test sets an x-test-user header to act as that user.
const api = createApi({
  resolveSession: async (req) => {
    const id = req.headers.get("x-test-user");
    return id ? { id, email: `${id}@example.com` } : null;
  },
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

  it("onboards a user and emits profile.onboarded", async () => {
    await seedUser("u_ob");
    const res = await call("/me/onboard", {
      method: "POST",
      headers: { "x-test-user": "u_ob", "content-type": "application/json" },
      body: JSON.stringify({ username: "onboarded" }),
    });
    expect(res.status).toBe(201);

    const db = createDb(env.DB);
    const events = await db.select().from(schema.activityEvents);
    expect(events.some((e) => e.type === "profile_onboarded")).toBe(true);
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
});
