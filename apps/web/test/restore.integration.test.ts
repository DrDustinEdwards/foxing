import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { callApi, seedUser, testApi } from "./test-api";

// The restoration pass: admin user-detail operator mutations and the
// settings username change/availability endpoints. The
// mutation and username contracts drive the API directly (x-test-user stands in for the
// Better Auth session the Worker injects). The visible admin UI is covered by Playwright.

const api = testApi({
  // Cloudflare Access let the request through, unless the test says it did not.
  checkAdminAccess: async (req) => req.headers.get("x-test-no-access") === null,
});

const call = (
  path: string,
  user: string,
  req?: Omit<NonNullable<Parameters<typeof callApi>[2]>, "user">,
) => callApi(api, path, { ...req, user });

describe("admin user-detail operator mutations", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.notifications);
    await db.delete(schema.adminAuditLog);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin");
    await seedUser("reader", "free");
  });

  // Tier and suspend changes are preview then perform, covered in admin.integration.test.ts.
  it("sends a single-user notification", async () => {
    const res = await call("/admin/users/reader/notify", "admin", {
      method: "POST",
      body: { title: "Heads up", body: "A note." },
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
      body: { tier: "plus" },
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
      body: { username: "taken" },
    });
    expect(conflict.status).toBe(409);
    const ok = await call("/me/username", "mover", {
      method: "PATCH",
      body: { username: "moved" },
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
