import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import {
  createSiteApi,
  type ContentDoc,
  type Diff,
  type ErrorBody,
  type PublishEvent,
  type RevisionList,
  type WriteResult,
} from "@dustinedwards/site-api";
import { runConformance } from "@dustinedwards/site-api/conformance";
import { d1SiteApiStore } from "@dustinedwards/site-api/store";
import { adminRepo, catalogRepo, createDb, schema } from "@foxing/core";
import { Hono } from "hono";
import { createRequestHandler, type ServerBuild } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionUserFromRequest } from "../app/lib/auth.server";
import { journalSiteAdapter } from "../app/lib/carrel/journal-adapter.server";
import { mountCarrel } from "../app/lib/carrel/site-api.server";
import { testApi } from "./test-api";

// Carrel's site API on the Worker, composed as workers/app.ts composes it: mountCarrel first, with
// site-api's D1 store (so the conformance suite's replay checks run), then /api/v1 with the real
// Better Auth session resolver, then a stand-in for the React Router catch-all. The planted tests
// (PLANT:) each send a request a guard must refuse and check that nothing in D1 changed.

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

// The real root and journal route (test/server-build.stub.ts), which a preview draws.
const renderDocument = createRequestHandler(
  () => import("virtual:react-router/server-build") as Promise<ServerBuild>,
  "test",
);

function worker(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  mountCarrel(app, (request, context) => renderDocument(request, context));
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

const source = (
  title: string,
  body = "New body.",
  extra = 'authors: ["Foxing"]\nseries: null\nseriesPart: null',
) =>
  `---\ntitle: ${JSON.stringify(title)}\nexcerpt: null\ncover_image_url: null\ncover_image_alt: null\ntags: ["essays"]\nfeatured: false\n${extra}\n---\n\n${body}`;

/** A staff member a post can credit (fake data): an admin with a display name. */
async function seedStaff(id: string, displayName: string) {
  const at = new Date();
  await db()
    .insert(schema.user)
    .values({
      id,
      name: displayName,
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: at,
      updatedAt: at,
    });
  await db()
    .insert(schema.profiles)
    .values({ id, username: id, displayName, isAdmin: true, createdAt: at, updatedAt: at });
}

async function auditRows() {
  return db().select().from(schema.adminAuditLog);
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM scheduled_updates").run();
  await db().delete(schema.journalSlugRedirects);
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
    // Its previews draw the real journal route, whose first render loads the page's modules.
  }, 30_000);
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
      expect(await res.json()).toMatchObject({ error: "unauthorized", message: "Unauthorized." });
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
    // What the Journal's rules refuse is refused, naming the field.
    const bad = await call(
      `${PREFIX}/content/Bad_Slug/draft`,
      json("PUT", { source: source("T"), expectedVersion: null, changeId: "ch-bad" }),
    );
    expect(bad.status).toBe(422);
    expect((await body(bad)).message).toContain("the id (slug)");

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

  it("credits a staff author and a series, filters by author, and keeps every field of every write in history", async () => {
    await seedStaff("staff-1", "Ada Reader");
    const post = await seedPost("edited", { isPublished: true });
    const credited = 'authors: ["Ada Reader"]\nseries: "Rereading Eliot"\nseriesPart: "2"';
    const save = (src: string, expectedVersion: string, changeId: string) =>
      call(
        `${PREFIX}/content/edited/draft`,
        json("PUT", { source: src, expectedVersion, changeId }),
      );

    // A name that is no one on the staff is refused, naming who can be credited.
    const unknown = await save(
      source("T", "B", 'authors: ["Someone Else"]\nseries: null\nseriesPart: null'),
      String(post.updatedAt.getTime()),
      "ch-unknown",
    );
    expect(unknown.status).toBe(422);
    expect((await body(unknown)).message).toContain("Foxing, Ada Reader");

    const saved = await save(
      source("Edited title", "Edited body.", credited),
      String(post.updatedAt.getTime()),
      "ch-edit",
    );
    expect(saved.status).toBe(200);
    // A save to a live post keeps it live.
    const after = await body<WriteResult>(saved);
    expect(after.status).toBe("published");
    expect(await adminRepo.getJournalBySlug(db(), "edited")).toMatchObject({
      authorId: "staff-1",
      series: "Rereading Eliot",
      seriesPart: 2,
    });
    const doc = await body<ContentDoc>(call(`${PREFIX}/content/edited`, withKey()));
    expect(doc.authors).toEqual(["Ada Reader"]);
    expect(doc.source).toBe(source("Edited title", "Edited body.", credited));

    // The author filter: by the staff member's name, and Foxing's for posts with none.
    await seedPost("uncredited");
    const ids = async (author: string) =>
      (
        await body<{ items: Array<{ id: string }> }>(
          call(`${PREFIX}/content?author=${encodeURIComponent(author)}`, withKey()),
        )
      ).items.map((i) => i.id);
    expect(await ids("Ada Reader")).toEqual(["edited"]);
    expect(await ids("Foxing")).toEqual(["uncredited"]);
    expect(await ids("Nobody")).toEqual([]);

    // An unpublish and a publish each keep a version too, every field of it, under a person's name.
    const down = await body<WriteResult>(
      call(
        `${PREFIX}/content/edited/unpublish`,
        json("POST", { expectedVersion: after.version, changeId: "ch-down" }),
      ),
    );
    await call(
      `${PREFIX}/content/edited/publish`,
      json("POST", { expectedVersion: down.version, changeId: "ch-up" }),
    );
    const revisions = (
      await body<RevisionList>(call(`${PREFIX}/content/edited/revisions`, withKey()))
    ).items;
    expect(revisions.map((r) => [r.author, r.message.split(".")[0]])).toEqual([
      ["Ada Reader", "The post as it stands now"],
      ["Ada Reader", "The post before it was published"],
      ["Ada Reader", "The post before it was taken off the Journal"],
      ["Foxing", "The post before a save"],
    ]);
    const first = revisions[3].version;
    const original = await call(`${PREFIX}/content/edited/revisions/${first}`, withKey());
    expect(await original.text()).toContain("tags: []");
    const diff = await body<Diff>(call(`${PREFIX}/content/edited/diff?from=${first}`, withKey()));
    expect(diff.patch).toContain("-Original body.");
    expect(diff.patch).toContain("+Edited body.");
    expect(diff.patch).toContain('+tags: ["essays"]');
  });

  it("schedules a draft, which the cron publishes at its time and not before, under that time, with the hooks", async () => {
    const draft = await seedPost("dated");
    const publishAt = "2030-01-01T15:00:00.000Z";
    const scheduled = await body<WriteResult>(
      call(
        `${PREFIX}/content/dated/schedule`,
        json("POST", {
          expectedVersion: String(draft.updatedAt.getTime()),
          changeId: "ch-schedule",
          publishAt,
        }),
      ),
    );
    expect(scheduled.status).toBe("scheduled");
    const doc = await body<ContentDoc>(call(`${PREFIX}/content/dated`, withKey()));
    expect([doc.status, doc.publishAt, doc.version]).toEqual([
      "scheduled",
      publishAt,
      scheduled.version,
    ]);

    // The cron's site API, as runCarrelSchedules builds it, with a spy for its hooks.
    const heard: PublishEvent[] = [];
    const cron = createSiteApi({
      adapter: journalSiteAdapter({ env: testEnv(), sourceIp: null }),
      key: KEY,
      limiter: allowAll,
      store: d1SiteApiStore(env.DB),
      hooks: [{ name: "spy", run: (event) => void heard.push(event) }],
      log: () => {},
    });
    expect((await cron.runSchedules({ now: new Date("2030-01-01T14:59:00Z") })).applied).toEqual(
      [],
    );
    expect(await catalogRepo.getPostBySlug(db(), "dated")).toBeNull();
    expect(
      (await cron.runSchedules({ now: new Date("2030-01-01T15:00:30Z") })).applied,
    ).toHaveLength(1);
    const live = await catalogRepo.getPostBySlug(db(), "dated");
    expect(live?.publishedAt?.toISOString()).toBe(publishAt);
    expect(heard.map((e) => [e.action, e.trigger, e.path])).toEqual([
      ["publish", "schedule", "/journal/dated"],
    ]);
    expect((await body<ContentDoc>(call(`${PREFIX}/content/dated`, withKey()))).status).toBe(
      "published",
    );
    expect((await cron.runSchedules({ now: new Date("2030-01-01T15:01:00Z") })).applied).toEqual(
      [],
    );
  });

  it("previews an unsaved draft as the journal route draws it, never indexed, without writing", async () => {
    await seedStaff("staff-2", "Ada Reader");
    const res = await call(
      `${PREFIX}/preview`,
      json("POST", {
        source: source(
          "Preview me",
          "New body.",
          'authors: ["Ada Reader"]\nseries: "Rereading Eliot"\nseriesPart: 3',
        ),
      }),
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    // The real page: the site header and footer around the post, with its byline and series line.
    expect(html).toContain('data-cap="site-header"');
    expect(html).toContain('class="fx-footer"');
    expect(html).toContain('<h1 class="mt-3 fx-journal-post-title">Preview me</h1>');
    expect(html).toContain('By <span class="p-author h-card">Ada Reader</span>');
    expect(html).toContain("Part 3 of 3 in Rereading Eliot");
    expect(html).toContain("<p>New body.</p>");
    expect(html.match(/<meta name="robots"[^>]*>/g)).toEqual([
      '<meta name="robots" content="noindex"/>',
    ]);
    expect(await db().select().from(schema.journalPosts)).toEqual([]);
  });
});

describe("Carrel site API: v0.17.0 over the Journal", () => {
  const post = (id: string, op: string, b: unknown) =>
    call(`${PREFIX}/content/${id}/${op}`, json("POST", b));

  it("renames a live post with a 301 at its old address; a trashed one leaves the Journal and is deleted only from the trash", async () => {
    const live = await seedPost("old-name", { isPublished: true });
    const renamed = await post("old-name", "rename", {
      newId: "new-name",
      expectedVersion: String(live.updatedAt.getTime()),
      changeId: "ch-rename",
    });
    expect(renamed.status, await renamed.clone().text()).toBe(200);
    const moved = await body<WriteResult & { previousPath: string | null }>(renamed);
    expect(moved).toMatchObject({
      id: "new-name",
      status: "published",
      previousPath: "/journal/old-name",
    });
    expect(await catalogRepo.getJournalSlugRedirect(db(), "old-name")).toBe("new-name");
    expect((await call(`${PREFIX}/content/old-name`, withKey())).status).toBe(404);

    const del = (version: string, changeId: string) =>
      call(`${PREFIX}/content/new-name?expectedVersion=${version}&changeId=${changeId}`, {
        ...withKey(),
        method: "DELETE",
      });
    expect((await del(moved.version, "ch-del-1")).status).toBe(422);
    const trashed = await body<WriteResult>(
      post("new-name", "trash", { expectedVersion: moved.version, changeId: "ch-trash" }),
    );
    expect(trashed.status).toBe("draft");
    expect(await catalogRepo.getPostBySlug(db(), "new-name")).toBeNull();
    // A redirect leads only to a live post: no 301 to a 404 while it is in the trash.
    expect(await catalogRepo.getJournalSlugRedirect(db(), "old-name")).toBeNull();
    const listed = await body<{ items: Array<{ id: string }>; filtered: string[] }>(
      call(`${PREFIX}/content?trashed=true`, withKey()),
    );
    expect([listed.items.map((i) => i.id), listed.filtered]).toEqual([["new-name"], ["trashed"]]);
    expect((await del(trashed.version, "ch-del-2")).status).toBe(200);
    expect(await adminRepo.getJournalById(db(), live.id)).toBeNull();
    // The delete takes the redirects that led to it with it.
    expect(await db().select().from(schema.journalSlugRedirects)).toEqual([]);
  });

  it("opens a preview link without the key, never indexed, until its post goes to the trash", async () => {
    const draft = await seedPost("shared-draft");
    const made = await call(
      `${PREFIX}/preview-links`,
      json("POST", { id: "shared-draft", changeId: "ch-link" }),
    );
    expect(made.status, await made.clone().text()).toBe(201);
    const { url } = await body<{ url: string }>(made);
    const path = new URL(url).pathname;
    const open = await call(path);
    expect(open.status).toBe(200);
    expect(open.headers.get("x-robots-tag")).toContain("noindex");
    expect(await open.text()).toContain("Original body.");

    await post("shared-draft", "trash", {
      expectedVersion: String(draft.updatedAt.getTime()),
      changeId: "ch-trash-link",
    });
    expect((await call(path)).status).toBe(410);
  });
});
