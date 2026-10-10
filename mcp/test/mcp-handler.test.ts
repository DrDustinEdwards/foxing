/**
 * The MCP request layer end to end: JSON-RPC into handleMcp, through the real
 * server and tool registration, out to the fake foxing Worker, and back. Driven
 * at the 2025-11-25 era, the one measured clients open at today.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import type { Caller } from "../src/auth.ts";
import { handleMcp } from "../src/mcp-handler.ts";
import { TOOLS, type ToolEnv } from "../src/tools.ts";
import { WRITER, fakeFoxing, fakeLog, freshEnv, type FakeFoxing } from "./fakes.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ERA = "2025-11-25";

let foxing: FakeFoxing;
let env: ToolEnv;
let nextId = 1;

beforeEach(() => {
  foxing = fakeFoxing();
  env = freshEnv(foxing, fakeLog());
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
    assert.equal(listed.length, 9);
    for (const t of listed) {
      assert.match(t.name, /^foxing_[a-z_]+$/);
      for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
        assert.equal(typeof t.annotations[hint], "boolean", `${t.name} ${hint}`);
      }
    }
    // tools/list order is deterministic: registration order.
    assert.deepEqual(listed.map((t) => t.name), TOOLS.map((t) => t.name));
  });

  test("tools/call becomes one admin API request and returns its JSON", async () => {
    foxing.reply({ body: { totalUsers: 3 } });
    const message = await rpc("tools/call", { name: "foxing_get_health", arguments: {} });
    assert.equal(foxing.calls.length, 1);
    assert.equal(foxing.calls[0].url.pathname, "/api/v1/admin/stats");
    assert.deepEqual(message.result.structuredContent, { totalUsers: 3 });
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
    assert.equal(message.result.isError, true);
    assert.equal(foxing.calls.length, 0);
  });
});
