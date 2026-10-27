import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { legacyRedirectTarget } from "../app/lib/redirects";
import { testApi } from "./test-api";

// The restoration pass: legacy path 301s (one hop, no chains), admin user-detail operator mutations, and the
// settings username change/availability endpoints. Redirects are a pure function; the
// mutation and username contracts drive the API directly (x-test-user stands in for the
// Better Auth session the Worker injects). The visible admin UI is covered by Playwright.

describe("legacy redirect map", () => {
  it("sends every legacy path one hop to a live route, and keeps recap live", () => {
    const legacy = [
      "/sign-in",
      "/sign-up",
      "/book-clubs",
      "/book-clubs/oprah",
      "/series/dune",
      "/quotes/123",
      "/buddy-reads/abc",
      "/u/jane/shelves/abc",
    ];
    for (const p of legacy) {
      const target = legacyRedirectTarget(p);
      expect(target, p).not.toBeNull();
      expect(legacyRedirectTarget(target as string), `${p} chains`).toBeNull();
    }
    expect(legacyRedirectTarget("/u/jane/recap/2026")).toBeNull();
  });
});

const api = testApi({
  // Cloudflare Access let the request through, unless the test says it did not.
  checkAdminAccess: async (req) => req.headers.get("x-test-no-access") === null,
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

async function seedUser(id: string, opts: { isAdmin?: boolean; tier?: "free" | "plus" } = {}) {
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
    isAdmin: opts.isAdmin ?? false,
    subscriptionTier: opts.tier ?? "free",
    onboardedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("admin user-detail operator mutations", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.notifications);
    await db.delete(schema.adminAuditLog);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin", { isAdmin: true });
    await seedUser("reader", { tier: "free" });
  });

  // Tier and admin changes are preview then perform, covered in admin.integration.test.ts.
  it("blocks self-demotion", async () => {
    const self = await call("/admin/users/admin/admin", "admin", {
      method: "POST",
      body: JSON.stringify({ on: false }),
    });
    expect(self.status).toBe(422);
  });

  it("sends a single-user notification", async () => {
    const res = await call("/admin/users/reader/notify", "admin", {
      method: "POST",
      body: JSON.stringify({ title: "Heads up", body: "A note." }),
    });
    expect(res.status).toBe(200);
    const db = createDb(env.DB);
    const notes = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, "reader"));
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Heads up");
  });

  it("deletes a user but not the acting admin", async () => {
    const self = await call("/admin/users/admin", "admin", { method: "DELETE" });
    expect(self.status).toBe(422);
    const res = await call("/admin/users/reader", "admin", { method: "DELETE" });
    expect(res.status).toBe(200);
    const db = createDb(env.DB);
    const [gone] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, "reader"));
    expect(gone).toBeUndefined();
  });

  it("refuses operator mutations from a non-admin", async () => {
    const res = await call("/admin/users/admin/tier", "reader", {
      method: "POST",
      body: JSON.stringify({ tier: "plus" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("settings username change", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("taken");
    await seedUser("mover");
  });

  it("reports availability, treating your own name as free", async () => {
    const takenRes = await call("/me/username-available?username=taken", "mover");
    expect(await takenRes.json()).toEqual({ available: false });
    const freeRes = await call("/me/username-available?username=brandnew", "mover");
    expect(await freeRes.json()).toEqual({ available: true });
    const ownRes = await call("/me/username-available?username=mover", "mover");
    expect(await ownRes.json()).toEqual({ available: true });
  });

  it("changes the username, rejecting one already taken", async () => {
    const conflict = await call("/me/username", "mover", {
      method: "PATCH",
      body: JSON.stringify({ username: "taken" }),
    });
    expect(conflict.status).toBe(409);
    const ok = await call("/me/username", "mover", {
      method: "PATCH",
      body: JSON.stringify({ username: "moved" }),
    });
    expect(ok.status).toBe(200);
    const db = createDb(env.DB);
    const [row] = await db
      .select({ username: schema.profiles.username })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, "mover"));
    expect(row?.username).toBe("moved");
  });
});
