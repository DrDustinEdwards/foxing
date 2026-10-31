import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type {
  ContentDoc,
  Diff,
  ErrorBody,
  RevisionList,
  WriteResult,
} from "@dustinedwards/site-api";
import { runConformance } from "@dustinedwards/site-api/conformance";
import { adminRepo, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { journalPreviewContext } from "../app/context";
import { sessionUserFromRequest } from "../app/lib/auth.server";
import { mountCarrel } from "../app/lib/carrel/site-api.server";
import { testApi } from "./test-api";

// Carrel's site API on the Worker, composed as workers/app.ts composes it: mountCarrel first, then
// /api/v1 with the real Better Auth session resolver, then a stand-in for the React Router
// catch-all. The planted tests (PLANT:) each send a request a guard must refuse and check that
// nothing in D1 changed.

// Fake test data only: not a real key.
const KEY = "test-carrel-key-0123456789abcdefghijklmnop";
const ORIGIN = "https://foxing.test";
const PREFIX = "/api/carrel/v1";

type Limiter = { limit: (o: { key: string }) => Promise<{ success: boolean }> };
const allowAll: Limiter = { limit: async () => ({ success: true }) };

function testEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    ...env,
    BETTER_AUTH_URL: ORIGIN,
    BETTER_AUTH_SECRET: "test-secret-value-for-carrel-suite",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    CARREL_SITE_KEY: KEY,
    CARREL_RATE_LIMIT: allowAll,
    ...overrides,
  } as unknown as Env;
}

function worker(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  // The preview renders through the journal route; this stand-in echoes the draft it was handed.
  mountCarrel(app, async (request, context) => {
    const post = context.get(journalPreviewContext);
    return new Response(`<h1>${post?.title}</h1><p>${new URL(request.url).pathname}</p>`, {
      headers: { "content-type": "text/html" },
    });
  });
  app.route(
    "/api/v1",
    testApi({
      resolveSession: (req, e) => sessionUserFromRequest(req, e as unknown as Env),
    }),
  );
  app.all("*", (c) => c.text("page", 200));
  return app;
}

const app = worker();

async function call(path: string, init: RequestInit = {}, e: Env = testEnv()): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`${ORIGIN}${path}`, init), e, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** A response body, read as the type the contract gives it. */
async function body<T = ErrorBody>(res: Response | Promise<Response>): Promise<T> {
  return (await (await res).json()) as T;
}

const withKey = (init: RequestInit = {}, key = KEY): RequestInit => ({
  ...init,
  headers: {
    authorization: `Bearer ${key}`,
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  },
});

const json = (method: string, body: unknown) => withKey({ method, body: JSON.stringify(body) });

const db = () => createDb(env.DB);

async function seedPost(slug: string, opts: { isPublished?: boolean } = {}) {
  const id = await adminRepo.createJournalPost(
    db(),
    {
      title: `Title ${slug}`,
      slug,
      content: "Original body.",
      isPublished: opts.isPublished ?? false,
    },
    null,
  );
  const row = await adminRepo.getJournalById(db(), id);
  if (!row) throw new Error("seed failed");
  return row;
}

const source = (title: string, body = "New body.") =>
  `---\ntitle: ${JSON.stringify(title)}\nexcerpt: null\ncover_image_url: null\ncover_image_alt: null\ntags: ["essays"]\nfeatured: false\n---\n\n${body}`;

async function auditRows() {
  return db().select().from(schema.adminAuditLog);
}

async function seedAdmin(id: string) {
  await db()
    .insert(schema.user)
    .values({
      id,
      name: "Admin",
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await db().insert(schema.profiles).values({
    id,
    username: id,
    displayName: id,
    isAdmin: true,
    onboardedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

beforeEach(async () => {
  await db().delete(schema.journalPostVersions);
  await db().delete(schema.journalPosts);
  await db().delete(schema.adminAuditLog);
  await db().delete(schema.profiles);
  await db().delete(schema.user);
});

describe("Carrel site API: conformance", () => {
  it("passes site-api's own conformance suite", async () => {
    await seedPost("conformance-seed");
    const report = await runConformance({
      baseUrl: ORIGIN,
      key: KEY,
      fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        call(String(input).slice(ORIGIN.length), init)) as typeof fetch,
    });
    const failed = report.checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
    // The Journal's media library is offered, so the suite's media probes run (and pass, above).
    expect(report.checks.some((c) => c.name.startsWith("media"))).toBe(true);
    expect(report.ok).toBe(true);
    // Every write the suite sends is refused: nothing changed.
    expect(await auditRows()).toEqual([]);
  });
});

describe("PLANT: the key off its prefix", () => {
  const paths = [
    "/api/carrel/v2/meta",
    "/api/carrel/v1x/meta",
    "/api/carrel/meta",
    "/journal",
    "/admin/journal",
    "/api/v1/clubs",
    "/api/v1/me",
    "/api/auth/get-session",
  ];

  for (const path of paths) {
    it(`is refused at ${path}`, async () => {
      const res = await call(path, withKey());
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: "unauthorized",
        message: "The Carrel key is accepted only under /api/carrel/v1.",
      });
    });
  }

  it("leaves a request without the key alone", async () => {
    const res = await call("/journal");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("page");
  });
});

describe("PLANT: the key against an admin route", () => {
  it("cannot publish or edit a Journal post through /api/v1/admin", async () => {
    // An admin exists, so a key that leaked into the session path would have someone to act as.
    await seedAdmin("owner");
    const post = await seedPost("admin-target");
    const publish = await call(
      `/api/v1/admin/journal/${post.id}/publish`,
      json("POST", { on: true }),
    );
    expect(publish.status).toBe(401);
    const edit = await call(`/api/v1/admin/journal/${post.id}`, json("PATCH", { title: "Taken" }));
    expect(edit.status).toBe(401);
    const after = await adminRepo.getJournalById(db(), post.id);
    expect(after?.isPublished).toBe(false);
    expect(after?.title).toBe(post.title);
    expect(await auditRows()).toEqual([]);
  });
});

describe("PLANT: the wrong key", () => {
  const cases: Array<[string, RequestInit]> = [
    ["no header", {}],
    ["a different key", withKey({}, "z".repeat(KEY.length))],
    ["the key with one character more", withKey({}, `${KEY}x`)],
    ["the key under another scheme", { headers: { authorization: `Basic ${KEY}` } }],
  ];

  for (const [name, init] of cases) {
    it(`refuses ${name}`, async () => {
      await seedPost("wrong-key-target");
      const res = await call(`${PREFIX}/content`, init);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "unauthorized", status: 401 });
    });
  }

  it("refuses everything while the site key is unset", async () => {
    const res = await call(`${PREFIX}/meta`, withKey(), testEnv({ CARREL_SITE_KEY: undefined }));
    expect(res.status).toBe(503);
    expect((await body(res)).error).toBe("not-configured");
  });
});

describe("PLANT: a stale expectedVersion", () => {
  it("refuses a save, a publish and a create over an existing id, and writes nothing", async () => {
    const post = await seedPost("stale-target");
    const current = String(post.updatedAt.getTime());
    const stale = String(post.updatedAt.getTime() - 1);

    const save = await call(
      `${PREFIX}/content/stale-target/draft`,
      json("PUT", { source: source("Overwritten"), expectedVersion: stale, changeId: "c1" }),
    );
    expect(save.status).toBe(409);
    expect(await save.json()).toMatchObject({ error: "version-conflict", currentVersion: current });

    const publish = await call(
      `${PREFIX}/content/stale-target/publish`,
      json("POST", { expectedVersion: stale, changeId: "c2" }),
    );
    expect(publish.status).toBe(409);

    const create = await call(
      `${PREFIX}/content/stale-target/draft`,
      json("PUT", { source: source("Second"), expectedVersion: null, changeId: "c3" }),
    );
    expect(create.status).toBe(409);

    const after = await adminRepo.getJournalById(db(), post.id);
    expect(after).toEqual(post);
    expect(await db().select().from(schema.journalPostVersions)).toEqual([]);
    expect(await auditRows()).toEqual([]);
  });

  it("refuses a version for an id that does not exist, with a null currentVersion", async () => {
    const res = await call(
      `${PREFIX}/content/no-such-post/publish`,
      json("POST", { expectedVersion: "123", changeId: "c4" }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "version-conflict", currentVersion: null });
  });
});

describe("PLANT: an unknown route", () => {
  const cases: Array<[string, string]> = [
    ["GET", `${PREFIX}/no-such-route`],
    ["GET", `${PREFIX}/admin/journal`],
    ["POST", `${PREFIX}/content/a-post/delete`],
    ["GET", `${PREFIX}/content/a-post/source`],
  ];

  for (const [method, path] of cases) {
    it(`refuses ${method} ${path}`, async () => {
      await seedPost("a-post");
      const res = await call(path, withKey({ method }));
      expect(res.status).toBe(404);
      expect((await body(res)).error).toBe("not-found");
      expect(await auditRows()).toEqual([]);
    });
  }
});

describe("Carrel site API: the rate limit", () => {
  it("answers 429 when the binding refuses and 503 when it is missing", async () => {
    const limited = await call(
      `${PREFIX}/meta`,
      withKey(),
      testEnv({ CARREL_RATE_LIMIT: { limit: async () => ({ success: false }) } }),
    );
    expect(limited.status).toBe(429);
    const unbound = await call(
      `${PREFIX}/meta`,
      withKey(),
      testEnv({ CARREL_RATE_LIMIT: undefined }),
    );
    expect(unbound.status).toBe(503);
  });
});

describe("Carrel site API: the Journal adapter", () => {
  it("creates a draft, first-publishes it, and records Carrel's changeId", async () => {
    const created = await call(
      `${PREFIX}/content/new-essay/draft`,
      json("PUT", {
        source: source("A new essay", "Body *one*."),
        expectedVersion: null,
        changeId: "ch-create",
      }),
    );
    expect(created.status).toBe(200);
    const draft = await body<WriteResult>(created);
    expect(draft).toMatchObject({ id: "new-essay", status: "draft", changeId: "ch-create" });

    const row = await adminRepo.getJournalBySlug(db(), "new-essay");
    expect(row).toMatchObject({
      title: "A new essay",
      content: "Body *one*.",
      tags: ["essays"],
      authorId: null,
    });
    expect(row?.isPublished).toBe(false);

    const published = await call(
      `${PREFIX}/content/new-essay/publish`,
      json("POST", { expectedVersion: draft.version, changeId: "ch-publish" }),
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ status: "published", changeId: "ch-publish" });

    const doc = await body<ContentDoc>(call(`${PREFIX}/content/new-essay`, withKey()));
    expect(doc).toMatchObject({ status: "published", path: "/journal/new-essay", kind: "journal" });
    expect(doc.publishedAt).not.toBeNull();
    expect(doc.source).toBe(source("A new essay", "Body *one*."));

    const audit = await auditRows();
    expect(audit.map((a) => [a.action, a.actor, a.params?.changeId])).toEqual(
      expect.arrayContaining([
        ["journal.create", "carrel", "ch-create"],
        ["journal.publish", "carrel", "ch-publish"],
      ]),
    );
    expect(audit.find((a) => a.action === "journal.publish")?.params?.firstPublish).toBe(true);
  });

  it("saves through updateJournalPost, keeping history, and diffs against it", async () => {
    const post = await seedPost("edited", { isPublished: true });
    const saved = await call(
      `${PREFIX}/content/edited/draft`,
      json("PUT", {
        source: source("Edited title", "Edited body."),
        expectedVersion: String(post.updatedAt.getTime()),
        changeId: "ch-edit",
      }),
    );
    expect(saved.status).toBe(200);
    // A save to a live post keeps it live.
    expect(await saved.json()).toMatchObject({ status: "published" });

    const revisions = (
      await body<RevisionList>(call(`${PREFIX}/content/edited/revisions`, withKey()))
    ).items;
    expect(revisions).toHaveLength(2);
    const earlier = revisions[1].version;
    const diff = await body<Diff>(call(`${PREFIX}/content/edited/diff?from=${earlier}`, withKey()));
    expect(diff.patch).toContain("-Original body.");
    expect(diff.patch).toContain("+Edited body.");
  });

  it("refuses what the admin routes refuse, and a schedule", async () => {
    const bad = await call(
      `${PREFIX}/content/Bad_Slug/draft`,
      json("PUT", { source: source("T"), expectedVersion: null, changeId: "ch-bad" }),
    );
    expect(bad.status).toBe(422);
    expect((await body(bad)).message).toContain("the id (slug)");

    const post = await seedPost("dated");
    const schedule = await call(
      `${PREFIX}/content/dated/schedule`,
      json("POST", {
        expectedVersion: String(post.updatedAt.getTime()),
        changeId: "ch-schedule",
        publishAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );
    expect(schedule.status).toBe(422);
    expect((await adminRepo.getJournalById(db(), post.id))?.isPublished).toBe(false);
  });

  it("previews an unsaved draft through the journal route without writing", async () => {
    const res = await call(`${PREFIX}/preview`, json("POST", { source: source("Preview me") }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>Preview me</h1><p>/journal/carrel-preview</p>");
    expect(await db().select().from(schema.journalPosts)).toEqual([]);
  });
});

describe("the admin Journal write functions after the shared guard change", () => {
  it("still save, snapshot and publish when called as the admin routes call them", async () => {
    await seedAdmin("admin");
    const post = await seedPost("admin-edit");
    // No guard: the admin routes pass none.
    expect(await adminRepo.updateJournalPost(db(), post.id, { title: "By admin" }, "admin")).toBe(
      true,
    );
    expect(await adminRepo.setJournalPublished(db(), post.id, true)).toBe(true);
    const after = await adminRepo.getJournalById(db(), post.id);
    expect(after).toMatchObject({ title: "By admin", isPublished: true });
    expect(after?.updatedAt.getTime()).toBeGreaterThan(post.updatedAt.getTime());
    const versions = await db()
      .select()
      .from(schema.journalPostVersions)
      .where(eq(schema.journalPostVersions.postId, post.id));
    expect(versions.map((v) => [v.title, v.savedBy])).toEqual([[post.title, "admin"]]);
  });
});
