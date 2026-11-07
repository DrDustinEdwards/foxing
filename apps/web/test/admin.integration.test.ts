import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/app";
import { testApi } from "./test-api";

// The admin write surface is gated on the admin list (ADMIN_EMAIL and CO_OWNER_EMAILS, set in vitest.config.ts) and logs every mutation to
// admin_audit_log. This drives the API contract directly (the x-test-user stub stands in
// for the Better Auth session the Worker injects). The visible admin UI is covered by the
// Playwright admin specs, which need a seeded admin account.
const api = testApi({
  // Cloudflare Access let the request through, unless the test says it did not.
  checkAdminAccess: async (req) => req.headers.get("x-test-no-access") === null,
});

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
  await db.insert(schema.profiles).values({
    id,
    username: id,
    displayName: id,
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
    await seedUser("admin");
    await seedUser("reader");
  });

  it("lets ADMIN_EMAIL and CO_OWNER_EMAILS alone decide, in any case, and unset admits nobody", async () => {
    const asUser = (user: string, ADMIN_EMAIL: string, CO_OWNER_EMAILS = "") =>
      api.fetch(
        new Request("https://test.local/admin/users", { headers: { "x-test-user": user } }),
        { ...env, ADMIN_EMAIL, CO_OWNER_EMAILS } as never,
      );
    expect((await asUser("reader", " Reader@Example.com ")).status).toBe(200);
    expect((await asUser("admin", " Reader@Example.com ")).status).toBe(403);
    expect((await asUser("admin", "")).status).toBe(403);
    expect((await asUser("admin", "", "admin@example.com")).status).toBe(403);
    expect((await asUser("reader", "admin@example.com", " Reader@Example.com")).status).toBe(200);
  });

  it("rejects an anonymous request with 401", async () => {
    const res = await post("/admin/announcements", null, { title: "Hi", body: "There" });
    expect(res.status).toBe(401);
  });

  it("rejects an admin whose request Cloudflare Access did not sign for them", async () => {
    const res = await call("/admin/announcements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user": "admin",
        "x-test-no-access": "1",
      },
      body: JSON.stringify({ title: "Hi", body: "There" }),
    });
    expect(res.status).toBe(403);
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
// writes. These guard the "one click changes a role" bug class.
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

const tierOf = async (id: string) => (await profileOf(id)).subscriptionTier;

async function previewPlus(target: string, actor = "admin"): Promise<string> {
  const res = await post(`/admin/users/${target}/tier`, actor, { tier: "plus" });
  expect(res.status).toBe(200);
  return ((await res.json()) as Preview).confirm.token;
}

const performPlus = (target: string, token: string, actor = "admin") =>
  post(`/admin/users/${target}/tier`, actor, { tier: "plus", confirm: token });

describe("admin 404 report and catalog health", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await db.delete(schema.books);
    await env.DB.prepare("DELETE FROM page_404_daily").run();
    await seedUser("admin");
    await seedUser("reader");
  });

  const get = (pathname: string, user: string | null = "admin") =>
    call(pathname, { headers: user ? { "x-test-user": user } : {} });

  it("reports the counted 404s, most-hit first, with probes left out; admin only", async () => {
    const day = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    const insert = env.DB.prepare(
      "INSERT INTO page_404_daily (id, day, path, referrer_host, kind, hit_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    );
    await env.DB.batch([
      insert.bind("a", day, "/old-page", "example.com", "page", 5),
      insert.bind("b", day, "/other", "", "page", 2),
      insert.bind("c", day, "/wp-login.php", "", "probe", 40),
    ]);
    const res = await get("/admin/not-found?days=7");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      days: number;
      items: Array<{ path: string; hits: number }>;
    };
    expect(body.items.map((i) => [i.path, i.hits])).toEqual([
      ["/old-page", 5],
      ["/other", 2],
    ]);
    expect((await get("/admin/not-found", "reader")).status).toBe(403);
    expect((await get("/admin/not-found?days=0")).status).toBe(422);
  });

  it("finds the catalog's problems: counts for every check, findings for the one asked", async () => {
    const db = createDb(env.DB);
    const base = {
      author: "Jane Austen",
      source: "gutenberg",
      sourceType: "catalog",
      language: "en",
      description: "A novel.",
      epubUrl: "https://covers.foxing.app/x.epub",
      coverUrl: "https://covers.foxing.app/x.jpg",
      publicationYear: 1813,
      subjects: ["Fiction"],
    };
    await db.insert(schema.books).values([
      { ...base, id: "ok", title: "Emma", slug: "emma" },
      { ...base, id: "p1", title: "Pride and Prejudice", slug: "pride-1" },
      { ...base, id: "p2", title: "The Pride & Prejudice", slug: "pride-2", coverUrl: null },
      { ...base, id: "bad", title: "Persuasion", slug: "persuasion", isbn: "0306406153" },
    ]);
    const res = await get("/admin/catalog-health?check=duplicate_title_author");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      checkedBooks: number;
      checks: Array<{ check: string; count: number }>;
      items: Array<{ bookId: string; check: string }>;
    };
    expect(body.checkedBooks).toBe(4);
    const counts = Object.fromEntries(body.checks.map((c) => [c.check, c.count]));
    expect(counts).toMatchObject({
      duplicate_title_author: 2,
      missing_cover: 1,
      invalid_isbn: 1,
      missing_description: 0,
    });
    expect(body.items.map((i) => i.bookId).sort()).toEqual(["p1", "p2"]);
    expect((await get("/admin/catalog-health?check=nope")).status).toBe(422);
    expect((await get("/admin/catalog-health", "reader")).status).toBe(403);
  });
});

describe("admin role changes: preview then perform", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    const db = createDb(env.DB);
    await db.delete(schema.adminAuditLog);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin");
    await seedUser("admin2");
    await seedUser("reader");
    await seedUser("other");
  });

  it("a single request cannot change a tier: it returns a preview and changes nothing", async () => {
    const res = await post("/admin/users/reader/tier", "admin", { tier: "plus" });
    expect(res.status).toBe(200);
    expect(await tierOf("reader")).toBe("free");
    expect(await auditRows("user.tier")).toHaveLength(0);

    const body = (await res.json()) as Preview;
    expect(body.preview.target.username).toBe("reader");
    expect(body.preview.kind).toBe("tier");
    expect(body.preview.from).toBe("free");
    expect(body.preview.to).toBe("plus");
    expect(body.preview.summary).toContain("@reader moves to Plus");
    expect(body.confirm.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("performs with the confirmation token and records the actor", async () => {
    const token = await previewPlus("reader");
    expect((await performPlus("reader", token)).status).toBe(200);

    expect(await tierOf("reader")).toBe("plus");
    const rows = await auditRows("user.tier");
    expect(rows).toHaveLength(1);
    expect(rows[0].actor).toBe("admin");
    expect(rows[0].params).toEqual({ id: "reader", from: "free", to: "plus" });
  });

  it("refuses a reused token", async () => {
    const token = await previewPlus("reader");
    expect((await performPlus("reader", token)).status).toBe(200);
    // Put the target back, so only the spent token stands between a replay and a write.
    await createDb(env.DB)
      .update(schema.profiles)
      .set({ subscriptionTier: "free" })
      .where(eq(schema.profiles.id, "reader"));

    expect((await performPlus("reader", token)).status).toBe(409);
    expect(await tierOf("reader")).toBe("free");
    expect(await auditRows("user.tier")).toHaveLength(1);
  });

  it("refuses an expired token", async () => {
    const token = await previewPlus("reader");
    vi.useFakeTimers({ now: Date.now() + 121_000, toFake: ["Date"] });
    const res = await performPlus("reader", token);
    vi.useRealTimers();
    expect(res.status).toBe(409);
    expect(await tierOf("reader")).toBe("free");
    expect(await auditRows("user.tier")).toHaveLength(0);
  });

  it("refuses a stale token when the target changed after the preview", async () => {
    const token = await previewPlus("reader");
    // The target's tier moves after the preview, so the preview no longer describes the
    // change the token would perform.
    await createDb(env.DB)
      .update(schema.profiles)
      .set({ subscriptionTier: "plus" })
      .where(eq(schema.profiles.id, "reader"));
    expect((await performPlus("reader", token)).status).toBe(409);
    expect(await auditRows("user.tier")).toHaveLength(0);
  });

  it("a token minted for one user cannot change another", async () => {
    const token = await previewPlus("reader");
    expect((await performPlus("other", token)).status).toBe(409);
    expect(await tierOf("other")).toBe("free");
    expect(await tierOf("reader")).toBe("free");
    expect(await auditRows("user.tier")).toHaveLength(0);
  });

  it("a token is bound to the admin who previewed it and to the change it previewed", async () => {
    const token = await previewPlus("reader");
    expect((await performPlus("reader", token, "admin2")).status).toBe(409);

    const suspendPreview = (await (
      await post("/admin/users/reader/suspend", "admin", { suspended: true })
    ).json()) as Preview;
    expect((await performPlus("reader", suspendPreview.confirm.token)).status).toBe(409);

    const reader = await profileOf("reader");
    expect(reader.subscriptionTier).toBe("free");
    expect(reader.isSuspended).toBe(false);
  });

  it("suspend changes also need the confirmation token", async () => {
    const suspend = await post("/admin/users/reader/suspend", "admin", { suspended: true });
    expect(suspend.status).toBe(200);
    expect((await profileOf("reader")).isSuspended).toBe(false);

    const suspendToken = ((await suspend.json()) as Preview).confirm.token;
    expect(
      (
        await post("/admin/users/reader/suspend", "admin", {
          suspended: true,
          confirm: suspendToken,
        })
      ).status,
    ).toBe(200);
    expect((await profileOf("reader")).isSuspended).toBe(true);
    expect(await auditRows("user.suspend")).toHaveLength(1);
  });
});

// The operator bearer (middleware/operator.ts): the admin MCP Worker sends the token and
// names the acting admin. The token alone grants nothing; the named actor must be a
// current, unsuspended admin, read from D1 on each request.
const OPERATOR_TOKEN = "test-operator-token";
const operatorEnv = { ...env, ADMIN_OPERATOR_TOKEN: OPERATOR_TOKEN };

const operatorCall = (
  pathname: string,
  opts: { token?: string; actor?: string; method?: string; body?: unknown; envOverride?: object },
) =>
  api.fetch(
    new Request(`https://test.local${pathname}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.token !== undefined ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.actor ? { "X-Foxing-Admin-Id": opts.actor } : {}),
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    (opts.envOverride ?? operatorEnv) as never,
  );

type Page<T> = { items: T[]; has_more: boolean; next_offset: number | null };

describe("admin operator bearer", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.adminAuditLog);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin");
    await seedUser("reader");
  });

  it("lets the operator read as a named admin", async () => {
    const res = await operatorCall("/admin/users", { token: OPERATOR_TOKEN, actor: "admin" });
    expect(res.status).toBe(200);
    const page = (await res.json()) as Page<{ id: string }>;
    expect(page.items.map((u) => u.id).sort()).toEqual(["admin", "reader"]);
    expect(page.has_more).toBe(false);
  });

  it("refuses a wrong token with 401", async () => {
    const res = await operatorCall("/admin/users", { token: "not-the-token", actor: "admin" });
    expect(res.status).toBe(401);
  });

  it("refuses every bearer when the token is not configured", async () => {
    const res = await operatorCall("/admin/users", {
      token: OPERATOR_TOKEN,
      actor: "admin",
      envOverride: env,
    });
    expect(res.status).toBe(401);
  });

  it("refuses a valid token with no acting admin named", async () => {
    const res = await operatorCall("/admin/users", { token: OPERATOR_TOKEN });
    expect(res.status).toBe(401);
  });

  it("refuses a valid token acting as a non-admin or an unknown user", async () => {
    const asReader = await operatorCall("/admin/users", { token: OPERATOR_TOKEN, actor: "reader" });
    expect(asReader.status).toBe(403);
    const asNobody = await operatorCall("/admin/users", { token: OPERATOR_TOKEN, actor: "ghost" });
    expect(asNobody.status).toBe(403);
  });

  it("refuses a suspended admin, reads included", async () => {
    const db = createDb(env.DB);
    await db
      .update(schema.profiles)
      .set({ isSuspended: true })
      .where(eq(schema.profiles.id, "admin"));
    const res = await operatorCall("/admin/stats", { token: OPERATOR_TOKEN, actor: "admin" });
    expect(res.status).toBe(403);
  });

  it("does not authenticate routes outside /admin", async () => {
    const res = await operatorCall("/account/export", { token: OPERATOR_TOKEN, actor: "admin" });
    expect(res.status).toBe(401);
  });

  it("audits an operator write under the acting admin, marked via operator", async () => {
    const suspend = (body: object) =>
      operatorCall("/admin/users/reader/suspend", {
        token: OPERATOR_TOKEN,
        actor: "admin",
        method: "POST",
        body,
      });
    // Suspend is a role change, so the operator previews first and performs with the token.
    const preview = await suspend({ suspended: true });
    expect(preview.status).toBe(200);
    const { token } = ((await preview.json()) as Preview).confirm;
    const res = await suspend({ suspended: true, confirm: token });
    expect(res.status).toBe(200);
    const db = createDb(env.DB);
    const [audit] = await db.select().from(schema.adminAuditLog);
    expect(audit.action).toBe("user.suspend");
    expect(audit.actor).toBe("admin");
    expect(audit.params).toEqual({ id: "reader", from: false, to: true, via: "operator" });
  });

  it("pages a list with has_more and next_offset", async () => {
    const first = await operatorCall("/admin/users?limit=1", {
      token: OPERATOR_TOKEN,
      actor: "admin",
    });
    const page1 = (await first.json()) as Page<{ id: string }>;
    expect(page1.items).toHaveLength(1);
    expect(page1.has_more).toBe(true);
    expect(page1.next_offset).toBe(1);

    const second = await operatorCall("/admin/users?limit=1&offset=1", {
      token: OPERATOR_TOKEN,
      actor: "admin",
    });
    const page2 = (await second.json()) as Page<{ id: string }>;
    expect(page2.items).toHaveLength(1);
    expect(page2.has_more).toBe(false);
    expect(page2.next_offset).toBeNull();
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it("answers 404 for an unknown user and 422 for a bad limit", async () => {
    const missing = await operatorCall("/admin/users/ghost", {
      token: OPERATOR_TOKEN,
      actor: "admin",
    });
    expect(missing.status).toBe(404);
    const bad = await operatorCall("/admin/users?limit=500", {
      token: OPERATOR_TOKEN,
      actor: "admin",
    });
    expect(bad.status).toBe(422);
  });
});

describe("admin reads with a cookie session", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
    await seedUser("admin");
    await seedUser("reader");
  });

  it("serves an admin and refuses a reader and an anonymous caller", async () => {
    const get = (user: string | null) =>
      call("/admin/users/reader", { headers: user ? { "x-test-user": user } : {} });
    const asAdmin = await get("admin");
    expect(asAdmin.status).toBe(200);
    const body = (await asAdmin.json()) as { user: { id: string }; activity: unknown };
    expect(body.user.id).toBe("reader");
    expect(body.activity).toBeTruthy();
    expect((await get("reader")).status).toBe(403);
    expect((await get(null)).status).toBe(401);
  });
});

// The hour's idle sign-out on the browser admin APIs (workers/app.ts): a fetch() from an admin
// screen gets a 401 it can show, not the redirect to Access's logout, which fetch would follow
// and read as a success.
const b64url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

describe("admin idle sign-out", () => {
  it("answers an idle admin's API call with a 401 the admin screens show", async () => {
    // adminIdle reads the Access token's iat without verifying it; two hours ago is idle.
    const iat = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
    const token = `${b64url({ alg: "RS256" })}.${b64url({ sub: "admin", iat })}.sig`;
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request("https://foxing.test/api/v1/admin/announcements", {
        method: "POST",
        headers: { "cf-access-jwt-assertion": token, "content-type": "application/json" },
        body: "{}",
      }),
      env as unknown as Env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("admin_idle");
  });
});
