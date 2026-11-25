import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import type { Caller } from "../src/auth.ts";
import {
  OUTSIDE_DATA_NOTICE,
  toolListHash,
  toolListProblems,
} from "@dustinedwards/site-runtime/mcp-server";

import { handleMcp } from "../src/mcp-handler.ts";
import type { ToolEnv } from "../src/tools.ts";
import {
  READER,
  WRITER,
  fakeFoxing,
  fakeLog,
  freshEnv,
  type FakeFoxing,
  type FakeLog,
} from "./fakes.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ERA = "2025-11-25";
/** The read grant's tools/list hash; the daily check pins the same. Update after reviewing a tool change. */
const READ_LIST_HASH = "4494b19d0efbadb2e2eb6c6929b487ba40ce662f0bc8753f73108631ebbbd0d3";

let foxing: FakeFoxing;
let log: FakeLog;
let env: ToolEnv;
let nextId = 1;

beforeEach(() => {
  foxing = fakeFoxing();
  log = fakeLog();
  env = freshEnv(foxing, log);
});

async function rpc(
  method: string,
  params: Record<string, unknown>,
  caller: Caller | null = WRITER,
) {
  const response = await handleMcp(
    new Request("https://admin-mcp.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": ERA,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
    env,
    ctx,
    caller ?? undefined,
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data ? data.slice(6) : text);
}

describe("handleMcp", () => {
  test("initialize names the server and carries the instructions", async () => {
    const message = await rpc("initialize", {
      protocolVersion: ERA,
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    assert.equal(message.result.serverInfo.name, "foxing-admin-mcp");
    assert.match(message.result.instructions, /Carrel owns all writing/);
    assert.equal(foxing.calls.length, 0);
  });

  test("PLANT: both grants' tools/list pass the family's list check (T1-T4, T9), and the read list is pinned (T12)", async () => {
    for (const caller of [WRITER, READER]) {
      const { tools } = (await rpc("tools/list", {}, caller)).result;
      assert.ok(tools.length > 0);
      assert.deepEqual(
        toolListProblems(tools)
          .filter((p) => p.severity === "error")
          .map((p) => `${p.item} ${p.tool}: ${p.detail}`),
        [],
      );
    }
    const read = (await rpc("tools/list", {}, READER)).result.tools;
    assert.equal(await toolListHash(read), READ_LIST_HASH);
  });

  test("tools/call becomes one admin API request, logged before and after, and returns its JSON", async () => {
    const stats = {
      totalUsers: 3,
      plusUsers: 1,
      suspendedUsers: 0,
      totalBooks: 9,
      staffPicks: 2,
      totalClubs: 1,
      publishedJournal: 4,
      publishedBotm: 1,
      recentSignups: [],
    };
    foxing.reply({ body: stats }, { body: { days: 7, items: [] } });
    const message = await rpc("tools/call", { name: "foxing_get_health", arguments: {} });
    assert.equal(foxing.calls.length, 2);
    assert.equal(foxing.calls[0].url.pathname, "/api/v1/admin/stats");
    assert.deepEqual(message.result.structuredContent, {
      notice: OUTSIDE_DATA_NOTICE,
      ...stats,
      notFound: { days: 7, totalHits: 0, top: [] },
    });
    assert.deepEqual(
      log.rows.map((r) => r.phase),
      ["started", "finished"],
    );
  });

  test("PLANT 12.3: a read-only grant is not listed the write tools, is refused one, and sends nothing (T7)", async () => {
    const listed = (await rpc("tools/list", {}, READER)).result.tools.map(
      (t: { name: string }) => t.name,
    );
    assert.ok(listed.includes("foxing_get_health"));
    assert.ok(!listed.includes("foxing_edit_book") && !listed.includes("foxing_moderate_user"));
    assert.ok(listed.includes("foxing_check_catalog"));
    assert.ok(
      listed.includes("foxing_read_book_of_month") && !listed.includes("foxing_set_book_of_month"),
      listed.join(),
    );
    const message = await rpc(
      "tools/call",
      { name: "foxing_edit_book", arguments: { book_id: "b1", title: "New" } },
      READER,
    );
    assert.ok(
      message.error !== undefined || message.result?.isError === true,
      JSON.stringify(message),
    );
    assert.equal(foxing.calls.length, 0);
  });

  for (const [label, name, args, caller] of [
    ["a schema violation", "foxing_find_user", { limit: 500 }, WRITER],
    ["a dropped tool", "create_journal_post", {}, WRITER],
    ["no caller", "foxing_get_health", {}, null],
  ] as const) {
    test(`${label} runs nothing and sends no request`, async () => {
      const message = await rpc("tools/call", { name, arguments: args }, caller);
      assert.ok(
        message.error !== undefined || message.result?.isError === true,
        JSON.stringify(message),
      );
      assert.equal(foxing.calls.length, 0);
    });
  }
});
