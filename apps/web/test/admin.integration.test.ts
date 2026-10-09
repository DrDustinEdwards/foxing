import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { billing, createDb, schema } from "@foxing/core";
import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Role and permission changes are preview then perform: the first request returns who
// gains what and a single-use token, and only a second request carrying that token
// writes. These guard the "one click grants admin" bug class.
type Preview = {
  preview: {
    target: { id: string; username: string };
    kind: string;
    from: boolean | string;
    to: boolean | string;
    summary: string;
  };
  confirm: { token: string; expiresAt: string };
};

async function profileOf(id: string) {
  const [row] = await createDb(env.DB)
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, id));
  return row;
}

async function auditRows(action: string) {
  return createDb(env.DB)
    .select()
    .from(schema.adminAuditLog)
    .where(eq(schema.adminAuditLog.action, action));
}

async function previewGrant(target: string, actor = "admin"): Promise<string> {
  const res = await post(`/admin/users/${target}/admin`, actor, { on: true });
  expect(res.status).toBe(200);
  return ((await res.json()) as Preview).confirm.token;
}

describe("admin role changes: preview then perform", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    const db = createDb(env.DB);
    await db.delete(schema.adminAuditLog);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin", { isAdmin: true });
    await seedUser("admin2", { isAdmin: true });
    await seedUser("reader", { isAdmin: false });
    await seedUser("other", { isAdmin: false });
  });

  it("a single request cannot grant admin: it returns a preview and changes nothing", async () => {
    const res = await post("/admin/users/reader/admin", "admin", { on: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Preview;
    expect(body.preview.target.username).toBe("reader");
    expect(body.preview.kind).toBe("admin");
    expect(body.preview.from).toBe(false);
    expect(body.preview.to).toBe(true);
    expect(body.preview.summary).toContain("@reader gains admin");
    expect(body.confirm.token).toMatch(/^[0-9a-f]{64}$/);

    expect((await profileOf("reader")).isAdmin).toBe(false);
    expect(await auditRows("user.grant_admin")).toHaveLength(0);
  });

  it("grants admin with the confirmation token and records the actor", async () => {
    const token = await previewGrant("reader");
    const res = await post("/admin/users/reader/admin", "admin", { on: true, confirm: token });
    expect(res.status).toBe(200);

    expect((await profileOf("reader")).isAdmin).toBe(true);
    const rows = await auditRows("user.grant_admin");
    expect(rows).toHaveLength(1);
    expect(rows[0].actor).toBe("admin");
    expect(rows[0].params).toEqual({ id: "reader", from: false, to: true });
  });

  it("refuses a reused token", async () => {
    const token = await previewGrant("reader");
    expect(
      (await post("/admin/users/reader/admin", "admin", { on: true, confirm: token })).status,
    ).toBe(200);
    // Put the target back, so only the spent token stands between a replay and a write.
    await createDb(env.DB)
      .update(schema.profiles)
      .set({ isAdmin: false })
      .where(eq(schema.profiles.id, "reader"));

    const replay = await post("/admin/users/reader/admin", "admin", { on: true, confirm: token });
    expect(replay.status).toBe(409);
    expect((await profileOf("reader")).isAdmin).toBe(false);
    expect(await auditRows("user.grant_admin")).toHaveLength(1);
  });

  it("refuses an expired token", async () => {
    const token = await previewGrant("reader");
    vi.useFakeTimers({ now: Date.now() + 121_000, toFake: ["Date"] });
    const res = await post("/admin/users/reader/admin", "admin", { on: true, confirm: token });
    vi.useRealTimers();
    expect(res.status).toBe(409);
    expect((await profileOf("reader")).isAdmin).toBe(false);
    expect(await auditRows("user.grant_admin")).toHaveLength(0);
  });

  it("refuses a stale token when the target changed after the preview", async () => {
    const token = await previewGrant("reader");
    // The target's admin flag moves after the preview, so the preview no longer
    // describes the change the token would perform.
    await createDb(env.DB)
      .update(schema.profiles)
      .set({ isAdmin: true })
      .where(eq(schema.profiles.id, "reader"));
    const res = await post("/admin/users/reader/admin", "admin", { on: true, confirm: token });
    expect(res.status).toBe(409);
    expect(await auditRows("user.grant_admin")).toHaveLength(0);
  });

  it("a token minted for one user cannot grant another", async () => {
    const token = await previewGrant("reader");
    const res = await post("/admin/users/other/admin", "admin", { on: true, confirm: token });
    expect(res.status).toBe(409);
    expect((await profileOf("other")).isAdmin).toBe(false);
    expect((await profileOf("reader")).isAdmin).toBe(false);
    expect(await auditRows("user.grant_admin")).toHaveLength(0);
  });

  it("a token is bound to the admin who previewed it and to the change it previewed", async () => {
    const token = await previewGrant("reader");
    const byOther = await post("/admin/users/reader/admin", "admin2", { on: true, confirm: token });
    expect(byOther.status).toBe(409);

    const tierPreview = (await (
      await post("/admin/users/reader/tier", "admin", { tier: "plus" })
    ).json()) as Preview;
    const crossKind = await post("/admin/users/reader/admin", "admin", {
      on: true,
      confirm: tierPreview.confirm.token,
    });
    expect(crossKind.status).toBe(409);

    const reader = await profileOf("reader");
    expect(reader.isAdmin).toBe(false);
    expect(reader.subscriptionTier).toBe("free");
  });

  it("tier and suspend changes also need the confirmation token", async () => {
    const tier = await post("/admin/users/reader/tier", "admin", { tier: "plus" });
    const suspend = await post("/admin/users/reader/suspend", "admin", { suspended: true });
    expect(tier.status).toBe(200);
    expect(suspend.status).toBe(200);
    let reader = await profileOf("reader");
    expect(reader.subscriptionTier).toBe("free");
    expect(reader.isSuspended).toBe(false);

    const tierToken = ((await tier.json()) as Preview).confirm.token;
    const suspendToken = ((await suspend.json()) as Preview).confirm.token;
    expect(
      (await post("/admin/users/reader/tier", "admin", { tier: "plus", confirm: tierToken }))
        .status,
    ).toBe(200);
    expect(
      (
        await post("/admin/users/reader/suspend", "admin", {
          suspended: true,
          confirm: suspendToken,
        })
      ).status,
    ).toBe(200);
    reader = await profileOf("reader");
    expect(reader.subscriptionTier).toBe("plus");
    expect(reader.isSuspended).toBe(true);
    expect(await auditRows("user.tier")).toHaveLength(1);
    expect(await auditRows("user.suspend")).toHaveLength(1);
  });
});
