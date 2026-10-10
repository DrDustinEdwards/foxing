import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { billing, createDb, schema } from "@foxing/core";
import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

// The admin write surface is gated on profiles.is_admin and logs every mutation to
// admin_audit_log. This drives the API contract directly (the x-test-user stub stands in
// for the Better Auth session the Worker injects). The visible admin UI is covered by the
// Playwright admin specs, which need a seeded admin account.
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

const call = (pathname: string, init?: RequestInit) =>
  api.fetch(new Request(`https://test.local${pathname}`, init), env as never);

async function seedUser(id: string, opts: { isAdmin: boolean }) {
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
    isAdmin: opts.isAdmin,
    onboardedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const post = (pathname: string, user: string | null, body: unknown) =>
  call(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user": user } : {}),
    },
    body: JSON.stringify(body),
  });

describe("admin write surface gate + audit log", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.announcements);
    await db.delete(schema.adminAuditLog);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin", { isAdmin: true });
    await seedUser("reader", { isAdmin: false });
  });

  it("rejects an anonymous request with 401", async () => {
    const res = await post("/admin/announcements", null, { title: "Hi", body: "There" });
    expect(res.status).toBe(401);
  });

  it("rejects a signed-in non-admin with 403", async () => {
    const res = await post("/admin/announcements", "reader", { title: "Hi", body: "There" });
    expect(res.status).toBe(403);
  });

  it("lets an admin create an announcement and records the audit log", async () => {
    const res = await post("/admin/announcements", "admin", {
      title: "Maintenance window",
      body: "The reader is briefly offline tonight.",
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string };
    expect(created.id).toBeTruthy();

    const db = createDb(env.DB);
    const rows = await db.select().from(schema.announcements);
    expect(rows).toHaveLength(1);
    expect(rows[0].createdBy).toBe("admin");

    const [audit] = await db
      .select()
      .from(schema.adminAuditLog)
      .orderBy(desc(schema.adminAuditLog.performedAt))
      .limit(1);
    expect(audit.action).toBe("announcement.create");
    expect(audit.actor).toBe("admin");
  });

  it("blocks a non-admin from suspending a user", async () => {
    const res = await post("/admin/users/reader/suspend", "reader", { suspended: true });
    expect(res.status).toBe(403);
    const db = createDb(env.DB);
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, "reader"));
    expect(row.isSuspended).toBe(false);
  });
});
