import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { billing, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { legacyRedirectTarget } from "../app/lib/redirects";

// The restoration pass: legacy path 301s, admin user-detail operator mutations, and the
// settings username change/availability endpoints. Redirects are a pure function; the
// mutation and username contracts drive the API directly (x-test-user stands in for the
// Better Auth session the Worker injects). The visible admin UI is covered by Playwright.

describe("legacy redirect map (one hop, no chains)", () => {
  it("renames auth and celebrity-pick routes", () => {
    expect(legacyRedirectTarget("/sign-in")).toBe("/login");
    expect(legacyRedirectTarget("/sign-up")).toBe("/signup");
    expect(legacyRedirectTarget("/book-clubs")).toBe("/picks");
    expect(legacyRedirectTarget("/book-clubs/oprah")).toBe("/picks/oprah");
  });

  it("consolidates profile sub-pages but keeps recap and live routes", () => {
    expect(legacyRedirectTarget("/u/jane/library")).toBe("/u/jane");
    expect(legacyRedirectTarget("/u/jane/highlights")).toBe("/u/jane");
    expect(legacyRedirectTarget("/u/jane/shelves/abc")).toBe("/u/jane");
    // recap is a live route and must not be redirected away.
    expect(legacyRedirectTarget("/u/jane/recap/2026")).toBeNull();
    expect(legacyRedirectTarget("/u/jane")).toBeNull();
    expect(legacyRedirectTarget("/picks")).toBeNull();
  });

  it("never points a target at another redirect (no chains)", () => {
    for (const p of ["/login", "/signup", "/picks", "/picks/oprah", "/u/jane"]) {
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

  it("changes a user's tier and audits it", async () => {
    const res = await call("/admin/users/reader/tier", "admin", {
      method: "POST",
      body: JSON.stringify({ tier: "plus" }),
    });
    expect(res.status).toBe(200);
    const db = createDb(env.DB);
    const [row] = await db
      .select({ tier: schema.profiles.subscriptionTier })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, "reader"));
    expect(row?.tier).toBe("plus");
    const audit = await db.select().from(schema.adminAuditLog);
    expect(audit.some((a) => a.action === "user.tier")).toBe(true);
  });

  it("grants and revokes admin, but blocks self-demotion", async () => {
    const grant = await call("/admin/users/reader/admin", "admin", {
      method: "POST",
      body: JSON.stringify({ on: true }),
    });
    expect(grant.status).toBe(200);
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
    const [gone] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, "reader"));
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
