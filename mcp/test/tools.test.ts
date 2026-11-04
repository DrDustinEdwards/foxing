/**
 * The tools against a fake foxing Worker: what each one sends and how a
 * refusal comes back. The security floor (rule 12) around them is
 * site-runtime's invokeTool, tested there; its wiring is in mcp-handler.test.ts.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { OUTSIDE_DATA_NOTICE } from "@dustinedwards/site-runtime/mcp-server";

import { encodeCursor, TOOLS, type ToolEnv } from "../src/tools.ts";
import { FOXING_ADMIN_ID, TOKEN, fakeFoxing, fakeLog, freshEnv, type FakeFoxing } from "./fakes.ts";

let foxing: FakeFoxing;
let env: ToolEnv;

beforeEach(() => {
  foxing = fakeFoxing();
  env = freshEnv(foxing, fakeLog());
});

const tool = (name: string) => {
  const found = TOOLS.find((t) => t.name === name);
  assert.ok(found, `no tool ${name}`);
  return found;
};
const call = (name: string, args: Record<string, unknown> = {}) => tool(name).handler(env, args);
/** A write tool's two calls: the preview, then the same arguments with its confirm token. */
const confirmCall = async (name: string, args: Record<string, unknown>) => {
  const preview = await call(name, args);
  assert.equal(preview.structuredContent?.confirmation_required, true, preview.content[0].text);
  return call(name, { ...args, confirm: preview.structuredContent?.confirm });
};
const path = (i = 0) => `${foxing.calls[i].method} ${foxing.calls[i].url.pathname}${foxing.calls[i].url.search}`;

describe("every request", () => {
  test("carries the operator bearer and the acting admin, over the binding to /api/v1/admin", async () => {
    await call("foxing_get_health");
    assert.equal(foxing.calls.length, 1);
    const sent = foxing.calls[0];
    assert.equal(sent.url.origin, "https://foxing.app");
    assert.equal(sent.url.pathname, "/api/v1/admin/stats");
    assert.equal(sent.headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(sent.headers.get("x-foxing-admin-id"), FOXING_ADMIN_ID);
  });

  test("the token appears in no tool output", async () => {
    foxing.reply({ status: 403, body: { error: { code: "forbidden", message: "Admin only." } } });
    const outputs = [await call("foxing_get_health"), await call("foxing_find_user", { query: "a" })];
    for (const out of outputs) assert.ok(!JSON.stringify(out).includes(TOKEN));
  });
});

describe("reader data (rule 12.5)", () => {
  test("12.5: reader-written text is marked as data", async () => {
    foxing.reply({ body: { items: [], has_more: false, next_offset: null } });
    const out = await call("foxing_find_user", { query: "x" });
    assert.ok(out.content[0].text.startsWith(OUTSIDE_DATA_NOTICE));
    assert.match(out.content[0].text, /<data label="foxing-reader-data">/);
  });
});

describe("refusals", () => {
  test("the API's message, code and details come back verbatim as a tool error", async () => {
    foxing.reply({
      status: 422,
      body: { error: { code: "validation", message: "Invalid request.", details: { fieldErrors: { limit: ["bad"] } } } },
    });
    const out = await call("foxing_find_user", { limit: 50 });
    assert.equal(out.isError, true);
    assert.equal(
      out.content[0].text,
      'Invalid request.\ncode: validation\ndetails: {"fieldErrors":{"limit":["bad"]}}',
    );
    assert.equal(out.structuredContent?.status, 422);
  });

  test("an unreachable API reads as this server's failure, not an API refusal", async () => {
    foxing.reply({ throws: new Error("connection reset") });
    const out = await call("foxing_get_health");
    assert.match(out.content[0].text, /could not complete its request .*unreachable/);
    // S4: the raw error stays in the log.
    assert.ok(!out.content[0].text.includes("connection reset"));
  });

  test("a missing operator token refuses before any request", async () => {
    env.ADMIN_OPERATOR_TOKEN = "short";
    const out = await call("foxing_get_health");
    assert.match(out.content[0].text, /\(unconfigured\)/);
    assert.equal(foxing.calls.length, 0);
  });
});

describe("what each tool sends", () => {
  test("foxing_find_user and foxing_inspect_book pass the search and the page", async () => {
    foxing.reply({ body: { items: [], has_more: true, next_offset: 15 } });
    const page = await call("foxing_find_user", { query: "ada", limit: 5, cursor: encodeCursor(10) });
    assert.equal(page.structuredContent?.next_cursor, encodeCursor(15));
    assert.equal(page.structuredContent?.next_offset, undefined);
    await call("foxing_inspect_book", { query: "Persuasion" });
    assert.equal(path(0), "GET /api/v1/admin/users?q=ada&limit=5&offset=10");
    assert.equal(path(1), "GET /api/v1/admin/books?q=Persuasion");
  });

  test("foxing_get_user_state reads one user, with the id encoded", async () => {
    await call("foxing_get_user_state", { user_id: "a/b" });
    assert.equal(path(), "GET /api/v1/admin/users/a%2Fb");
  });

  test("foxing_edit_book maps fields to the API's names and sets the staff pick", async () => {
    const out = await confirmCall("foxing_edit_book", {
      book_id: "b1",
      title: "Persuasion",
      publication_year: 1817,
      staff_pick: { on: true, note: "A favorite" },
    });
    assert.equal(path(0), "PATCH /api/v1/admin/books/b1");
    assert.deepEqual(foxing.calls[0].body, { title: "Persuasion", publicationYear: 1817 });
    assert.equal(path(1), "POST /api/v1/admin/books/b1/staff-pick");
    assert.deepEqual(foxing.calls[1].body, { on: true, note: "A favorite" });
    assert.deepEqual(out.structuredContent, {
      book_id: "b1",
      applied: { fields: ["title", "publicationYear"], staff_pick: true },
    });
  });

  test("foxing_edit_book says which half landed when the staff pick is refused", async () => {
    foxing.reply({ body: { ok: true } }, { status: 404, body: { error: { code: "not_found", message: "Not found." } } });
    const out = await confirmCall("foxing_edit_book", { book_id: "b1", title: "X", staff_pick: { on: false } });
    assert.equal(out.isError, true);
    assert.match(out.content[0].text, /^The field changes were applied; the staff pick was refused\.\nNot found\./);
  });

  test("foxing_edit_book with nothing to change sends nothing", async () => {
    const out = await call("foxing_edit_book", { book_id: "b1" });
    assert.equal(out.isError, true);
    assert.equal(foxing.calls.length, 0);
  });

  test("foxing_set_book_of_month creates, updates and publishes; foxing_read_book_of_month pages the list", async () => {
    foxing.reply({ status: 201, body: { id: "m1" } });
    await confirmCall("foxing_set_book_of_month", {
      action: "create",
      year: 2026,
      month: 11,
      book_id: "b1",
      curator_note: "Read it slowly.",
      bookshop_url: "https://bookshop.org/x",
    });
    assert.equal(path(0), "POST /api/v1/admin/botm");
    assert.deepEqual(foxing.calls[0].body, {
      bookId: "b1",
      year: 2026,
      month: 11,
      curatorNote: "Read it slowly.",
      bookshopUrl: "https://bookshop.org/x",
    });

    await confirmCall("foxing_set_book_of_month", { action: "update", botm_id: "m1", category: "Classics" });
    assert.equal(path(1), "PATCH /api/v1/admin/botm/m1");
    assert.deepEqual(foxing.calls[1].body, { category: "Classics" });

    await confirmCall("foxing_set_book_of_month", { action: "unpublish", botm_id: "m1" });
    assert.equal(path(2), "POST /api/v1/admin/botm/m1/publish");
    assert.deepEqual(foxing.calls[2].body, { on: false });

    foxing.reply({ body: { items: [1, 2, 3] } });
    const page = await call("foxing_read_book_of_month", { action: "list", limit: 2 });
    assert.deepEqual(page.structuredContent, { items: [1, 2], total: 3, has_more: true, next_cursor: encodeCursor(2) });
  });

  test("foxing_set_book_of_month refuses a create with no month before any request", async () => {
    const out = await call("foxing_set_book_of_month", { action: "create", year: 2026 });
    assert.equal(out.isError, true);
    assert.equal(foxing.calls.length, 0);
  });

  test("foxing_review_club_picks reads the clubs and one club's picks, paged", async () => {
    foxing.reply({ body: { items: [{ id: "c1" }] } }, { body: { items: [{ id: "p1" }, { id: "p2" }] } });
    const out = await call("foxing_review_club_picks", { club_id: "c1", limit: 1 });
    assert.equal(path(0), "GET /api/v1/admin/pick-clubs");
    assert.equal(path(1), "GET /api/v1/admin/picks?club_id=c1");
    assert.deepEqual(out.structuredContent, {
      notice: OUTSIDE_DATA_NOTICE,
      clubs: [{ id: "c1" }],
      picks: { items: [{ id: "p1" }], total: 2, has_more: true, next_cursor: encodeCursor(1) },
    });
  });

  test("foxing_publish_club_pick edits, then publishes", async () => {
    await confirmCall("foxing_publish_club_pick", { pick_id: "p1", curator_quote: "Yes.", publish: true });
    assert.equal(path(0), "PATCH /api/v1/admin/picks/p1");
    assert.deepEqual(foxing.calls[0].body, { curatorQuote: "Yes." });
    assert.equal(path(1), "POST /api/v1/admin/picks/p1/publish");
    assert.deepEqual(foxing.calls[1].body, { on: true });
  });

  test("foxing_read_audit_log pages the site's log", async () => {
    await call("foxing_read_audit_log", { limit: 10, cursor: encodeCursor(20) });
    assert.equal(path(), "GET /api/v1/admin/audit-log?limit=10&offset=20");
  });
});

describe("confirmation (T11)", () => {
  test("PLANT: a write tool without confirm sends nothing and returns the preview", async () => {
    for (const [name, args] of [
      ["foxing_edit_book", { book_id: "b1", title: "X" }],
      ["foxing_set_book_of_month", { action: "publish", botm_id: "m1" }],
      ["foxing_publish_club_pick", { pick_id: "p1", publish: false }],
    ] as const) {
      const out = await call(name, args);
      assert.equal(out.structuredContent?.confirmation_required, true);
      assert.match(out.content[0].text, /^Nothing was changed\./);
    }
    assert.equal(foxing.calls.length, 0);
  });

  test("PLANT: a token for other arguments or another tool is refused and sends nothing", async () => {
    const preview = await call("foxing_edit_book", { book_id: "b1", title: "X" });
    const token = preview.structuredContent?.confirm;
    const changed = await call("foxing_edit_book", { book_id: "b2", title: "X", confirm: token });
    const otherTool = await call("foxing_publish_club_pick", { pick_id: "b1", publish: true, confirm: token });
    assert.equal(changed.isError, true);
    assert.equal(otherTool.isError, true);
    assert.equal(foxing.calls.length, 0);
  });
});

describe("cursors (T8)", () => {
  test("a cursor this server did not issue fails validation", () => {
    const schema = tool("foxing_find_user").config.inputSchema;
    assert.equal(schema.safeParse({ cursor: "10" }).success, false);
    assert.equal(schema.safeParse({ cursor: encodeCursor(10) }).success, true);
  });
});
