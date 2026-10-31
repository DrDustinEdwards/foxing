// The Journal's media library through the real Worker entry (workers/app.ts): Carrel's site API
// with the key, and the /media/journal/* route that serves what it stores. Real D1 with the real
// migrations and real local R2. Cloudflare Images and Workers AI have no local emulation, so both
// are stand-ins of their recorded shape: the image stand-in measures by the size it is given and
// appends what it was asked to do, so its output differs from its input.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { ErrorBody, MediaDetail, MediaItem, WriteResult } from "@dustinedwards/site-api";
import { adminRepo, createDb, schema } from "@foxing/core";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../workers/app";

// Fake test data only: not a real key.
const KEY = "test-carrel-key-0123456789abcdefghijklmnop";
const ORIGIN = "https://foxing.test";
const PREFIX = "/api/carrel/v1";

type Size = { width: number; height: number };
const MARK = "|edited:";

/** The Images binding's shape: info measures, input().transform().output() marks the bytes. */
function images(size: Size = { width: 1200, height: 800 }, after: Size = size) {
  return {
    info: async (stream: ReadableStream) => {
      const text = new TextDecoder().decode(await new Response(stream).arrayBuffer());
      return text.includes(MARK) ? after : size;
    },
    input: (stream: ReadableStream) => {
      const steps: unknown[] = [];
      const handle = {
        transform: (step: unknown) => {
          steps.push(step);
          return handle;
        },
        output: async () => {
          const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
          const marked = new Uint8Array([
            ...bytes,
            ...new TextEncoder().encode(`${MARK}${JSON.stringify(steps)}`),
          ]);
          return { response: () => new Response(marked) };
        },
      };
      return handle;
    },
  };
}

function testEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    ...env,
    BETTER_AUTH_URL: ORIGIN,
    BETTER_AUTH_SECRET: "test-secret-value-for-media-suite",
    CARREL_SITE_KEY: KEY,
    CARREL_RATE_LIMIT: { limit: async () => ({ success: true }) },
    IMAGES: images(),
    ...overrides,
  } as unknown as Env;
}

async function fetchWorker(path: string, init: RequestInit = {}, overrides = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, init), testEnv(overrides), ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** A Carrel call with the key: a JSON body, or raw bytes with their type. */
function carrel(
  method: string,
  path: string,
  body?: unknown,
  overrides: Record<string, unknown> = {},
): Promise<Response> {
  const raw = body instanceof Uint8Array;
  return fetchWorker(
    `${PREFIX}${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${KEY}`,
        ...(body === undefined ? {} : { "content-type": raw ? "image/png" : "application/json" }),
      },
      ...(body === undefined ? {} : { body: raw ? (body as BodyInit) : JSON.stringify(body) }),
    },
    overrides,
  );
}

async function read<T = ErrorBody>(res: Response | Promise<Response>): Promise<T> {
  return (await (await res).json()) as T;
}

/** Fake picture bytes behind a real PNG signature, which the package checks. */
function png(seed: string): Uint8Array<ArrayBuffer> {
  const body = new TextEncoder().encode(seed);
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...body]);
}

async function upload(seed: string, overrides: Record<string, unknown> = {}, extra = "") {
  const query = new URLSearchParams({ filename: `${seed}.png`, changeId: `chg-${seed}` });
  const res = await carrel("POST", `/media?${query}${extra}`, png(seed), overrides);
  expect(res.status, await res.clone().text()).toBe(201);
  return read<MediaItem & { resizedFrom?: Size & { bytes: number } }>(res);
}

const objectBytes = async (bucket: R2Bucket, key: string) => {
  const object = await bucket.get(key);
  return object ? new Uint8Array(await object.arrayBuffer()) : null;
};

const db = () => createDb(env.DB);

/** A media id as one path segment: its slashes encoded, as Carrel sends it. */
const enc = encodeURIComponent;

beforeEach(async () => {
  await db().delete(schema.journalMedia);
  await db().delete(schema.journalMediaRevisions);
  await db().delete(schema.journalPosts);
  await db().delete(schema.adminAuditLog);
});

describe("Journal media: upload, serve, use and delete", () => {
  it("serves an upload at its address, takes it as a cover, and refuses its delete while a post uses it", async () => {
    const item = await upload("reading-room");
    expect(item.id).toMatch(/^journal\/\d{4}\/\d{2}\/reading-room-[0-9a-f]{8}\.png$/);
    expect(item.url).toBe(`https://foxing.app/media/${item.id}`);

    const served = await fetchWorker(`/media/${item.id}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    // Carrel shows the library's thumbnails from another origin.
    expect(served.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(png("reading-room"));
    const again = await fetchWorker(`/media/${item.id}`, {
      headers: { "if-none-match": served.headers.get("etag") ?? "" },
    });
    expect(again.status).toBe(304);

    // The cover from the library, through the same save the admin rules check.
    const source = `---\ntitle: "On reading rooms"\nexcerpt: null\ncover_image_url: ${JSON.stringify(item.url)}\ncover_image_alt: "A reading room"\ntags: []\nfeatured: false\n---\n\nBody.`;
    const saved = await carrel("PUT", "/content/reading-rooms/draft", {
      source,
      expectedVersion: null,
      changeId: "chg-post",
    });
    expect(saved.status, await saved.clone().text()).toBe(200);

    const detail = await read<MediaDetail>(carrel("GET", `/media/${enc(item.id)}`));
    expect(detail.usedBy).toEqual([
      { type: "journal", id: "reading-rooms", title: "On reading rooms", detail: "cover image" },
    ]);
    expect(detail.usedCount).toBe(1);
    const refused = await carrel("DELETE", `/media/${enc(item.id)}?changeId=chg-delete`);
    expect(refused.status).toBe(422);
    expect(await objectBytes(env.MEDIA, item.id)).toEqual(png("reading-room"));

    const post = await adminRepo.getJournalBySlug(db(), "reading-rooms");
    await adminRepo.updateJournalPost(db(), post?.id ?? "", { coverImageUrl: null }, null);
    const deleted = await carrel("DELETE", `/media/${enc(item.id)}?changeId=chg-delete-2`);
    expect(deleted.status, await deleted.clone().text()).toBe(200);
    expect(await objectBytes(env.MEDIA, item.id)).toBeNull();
    expect((await fetchWorker(`/media/${item.id}`)).status).toBe(404);
    // The last bytes are kept, so a delete can be undone by hand.
    const kept = (await env.BACKUPS.list({ prefix: "journal-media/deleted/" })).objects;
    expect(kept.map((o) => o.key.endsWith(`/${item.id}`))).toContain(true);
  });

  it("refuses a stale version, even for two writes in the same second, and changes nothing", async () => {
    const item = await upload("stale-case");
    const first = await carrel("PUT", `/media/${enc(item.id)}/alt`, {
      alt: "A lamp on a desk",
      expectedVersion: item.version,
      changeId: "chg-alt-1",
    });
    expect(first.status).toBe(200);
    const { version } = await read<WriteResult>(first);
    const stale = await carrel("PUT", `/media/${enc(item.id)}/alt`, {
      alt: "Overwritten",
      expectedVersion: item.version,
      changeId: "chg-alt-2",
    });
    expect(stale.status).toBe(409);
    expect(await read(stale)).toMatchObject({ currentVersion: version });
    expect((await read<MediaDetail>(carrel("GET", `/media/${enc(item.id)}`))).alt).toBe(
      "A lamp on a desk",
    );
  });

  it("answers bytes it already holds with that file, and stores nothing new", async () => {
    const item = await upload("twice");
    const query = new URLSearchParams({ filename: "renamed.png", changeId: "chg-twice-2" });
    const res = await carrel("POST", `/media?${query}`, png("twice"));
    expect(res.status).toBe(200);
    expect(await read(res)).toMatchObject({ id: item.id, duplicateOf: item.id });
    expect(await db().select().from(schema.journalMedia)).toHaveLength(1);
  });
});

describe("Journal media: bytes and their history", () => {
  it("turns a picture in place, keeps the old bytes, and a revert puts them back", async () => {
    const item = await upload("turn-case");
    const turned = await carrel("POST", `/media/${enc(item.id)}/transform`, {
      op: "rotate-90",
      expectedVersion: item.version,
      changeId: "chg-turn",
    });
    expect(turned.status, await turned.clone().text()).toBe(200);
    const after = await read<MediaItem & { asNewFile: boolean }>(turned);
    expect(after).toMatchObject({ id: item.id, asNewFile: false, width: 800, height: 1200 });
    expect(await objectBytes(env.MEDIA, item.id)).not.toEqual(png("turn-case"));

    type History = { revisions: Array<{ rev: string; reason: string; current: boolean }> };
    const history = await read<History>(carrel("GET", `/media/${enc(item.id)}/history`));
    expect(history.revisions.map((r) => [r.reason, r.current])).toEqual([
      ["transform", true],
      ["upload", false],
    ]);
    const reverted = await carrel("POST", `/media/${enc(item.id)}/revert`, {
      to: history.revisions[1]?.rev,
      expectedVersion: after.version,
      changeId: "chg-revert",
    });
    expect(reverted.status, await reverted.clone().text()).toBe(200);
    expect(await objectBytes(env.MEDIA, item.id)).toEqual(png("turn-case"));
  });

  it("shrinks a large picture at upload unless asked not to, and keeps the original", async () => {
    const big = { IMAGES: images({ width: 6000, height: 4000 }, { width: 2560, height: 1707 }) };
    const shrunk = await upload("big-case", big);
    expect(shrunk).toMatchObject({
      width: 2560,
      resizedFrom: { width: 6000, height: 4000, bytes: png("big-case").length },
    });
    const kept = (await env.BACKUPS.list({ prefix: "journal-media/resized/" })).objects.find((o) =>
      o.key.endsWith(`/${shrunk.id}`),
    );
    expect(await objectBytes(env.BACKUPS, kept?.key ?? "")).toEqual(png("big-case"));

    const asIs = await upload("big-as-is", big, "&resize=no");
    expect(asIs).toMatchObject({ width: 6000, height: 4000 });
    expect(asIs.resizedFrom).toBeUndefined();
  });
});

describe("Journal media: what Carrel's library reads", () => {
  it("says what changed since a cursor, and names a file deleted for good", async () => {
    type Changes = { items: MediaItem[]; removed: string[]; changeCursor: string };
    const start = await read<Changes>(carrel("GET", "/media?limit=1"));
    const item = await upload("changes-case");
    const changed = await read<Changes>(carrel("GET", `/media?changedSince=${start.changeCursor}`));
    expect(changed.items.map((i) => i.id)).toEqual([item.id]);
    expect(changed.removed).toEqual([]);

    expect((await carrel("DELETE", `/media/${enc(item.id)}?changeId=chg-gone`)).status).toBe(200);
    const after = await read<Changes>(carrel("GET", `/media?changedSince=${changed.changeCursor}`));
    expect(after).toMatchObject({ items: [], removed: [item.id] });
  });

  it("suggests tags and alt text from the model, and applies neither", async () => {
    const item = await upload("suggest-case");
    const sent: string[] = [];
    const AI = {
      run: async (model: string, input: unknown) => {
        sent.push(model, JSON.stringify(input));
        return { response: '{"alt": "A stack of old books.", "tags": ["Books", "books", "x y!"]}' };
      },
    };
    const res = await carrel("GET", `/media/${enc(item.id)}/suggestions`, undefined, { AI });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toMatchObject({ alt: "A stack of old books.", tags: ["books"] });
    expect(sent.join()).toContain("data:image/jpeg;base64,");
    expect(await read<MediaDetail>(carrel("GET", `/media/${enc(item.id)}`))).toMatchObject({
      alt: "",
      tags: [],
    });
  });
});
