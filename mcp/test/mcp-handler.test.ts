/**
 * The MCP request layer end to end: JSON-RPC into handleMcp, through the real
 * server and tool registration, out to the fake foxing Worker, and back. Driven
 * at the 2025-11-25 era, the one measured clients open at today.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import type { Caller } from "../src/auth.ts";
import { OUTSIDE_DATA_NOTICE } from "@dustinedwards/site-runtime/mcp-server";

import { handleMcp } from "../src/mcp-handler.ts";
import { TOOLS, type ToolEnv } from "../src/tools.ts";
import { READER, WRITER, fakeFoxing, fakeLog, freshEnv, type FakeFoxing, type FakeLog } from "./fakes.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ERA = "2025-11-25";

let foxing: FakeFoxing;
let log: FakeLog;
let env: ToolEnv;
let nextId = 1;

beforeEach(() => {
  foxing = fakeFoxing();
  log = fakeLog();
  env = freshEnv(foxing, log);
});

async function rpc(method: string, params: Record<string, unknown>, caller: Caller | null = WRITER) {
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

  test("tools/list offers exactly the foxing_ tools, each with all four annotations", async () => {
    const message = await rpc("tools/list", {});
    const listed = message.result.tools as Array<{ name: string; annotations: Record<string, unknown> }>;
    assert.deepEqual(
      listed.map((t) => t.name).sort(),
      TOOLS.map((t) => t.name).sort(),
    );
    assert.equal(listed.length, 10);
    for (const t of listed) {
      assert.match(t.name, /^foxing_[a-z_]+$/);
      for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
        assert.equal(typeof t.annotations[hint], "boolean", `${t.name} ${hint}`);
      }
    }
    // tools/list order is deterministic: registration order.
    assert.deepEqual(listed.map((t) => t.name), TOOLS.map((t) => t.name));
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
    foxing.reply({ body: stats });
    const message = await rpc("tools/call", { name: "foxing_get_health", arguments: {} });
    assert.equal(foxing.calls.length, 1);
    assert.equal(foxing.calls[0].url.pathname, "/api/v1/admin/stats");
    // The stats carry readers' text (recent sign-ups), so the shared data notice rides beside them (S2).
    assert.deepEqual(message.result.structuredContent, { notice: OUTSIDE_DATA_NOTICE, ...stats });
    assert.deepEqual(log.rows.map((r) => r.phase), ["started", "finished"]);
  });

  test("PLANT 12.3: a read-only grant is not listed the write tools, is refused one, and sends nothing (T7)", async () => {
    const listed = (await rpc("tools/list", {}, READER)).result.tools.map((t: { name: string }) => t.name);
    assert.ok(listed.includes("foxing_get_health"));
    assert.ok(!listed.includes("foxing_edit_book"));
    // Every tool's scope is fixed, so the read grant's list is read-only throughout (the live check's T7).
    assert.ok(listed.includes("foxing_read_book_of_month") && !listed.includes("foxing_set_book_of_month"), listed.join());
    const message = await rpc("tools/call", { name: "foxing_edit_book", arguments: { book_id: "b1", title: "New" } }, READER);
    assert.ok(message.error !== undefined || message.result?.isError === true, JSON.stringify(message));
    assert.equal(foxing.calls.length, 0);
  });

  test("a schema violation fails before any request", async () => {
    const message = await rpc("tools/call", { name: "foxing_find_user", arguments: { limit: 500 } });
    assert.equal(foxing.calls.length, 0);
    assert.ok(message.error !== undefined || message.result?.isError === true, JSON.stringify(message));
  });

  test("a dropped tool does not exist", async () => {
    const message = await rpc("tools/call", { name: "create_journal_post", arguments: {} });
    assert.equal(foxing.calls.length, 0);
    assert.ok(message.error !== undefined || message.result?.isError === true, JSON.stringify(message));
  });

  test("a request with no caller runs no tool", async () => {
    const message = await rpc("tools/call", { name: "foxing_get_health", arguments: {} }, null);
    assert.ok(message.error !== undefined || message.result?.isError === true, JSON.stringify(message));
    assert.equal(foxing.calls.length, 0);
  });
});
