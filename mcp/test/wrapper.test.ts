/**
 * The no-second-path guarantees, read from the files themselves:
 * - the Worker's bindings are exactly the allowlist (no D1, R2, Stripe or any
 *   binding that reaches Foxing's data; FOXING is the only service binding),
 * - nothing in src/ imports Foxing's app or packages, so the admin API is the
 *   only way in,
 * - apiHandler refuses a token minted for another audience or another person.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { apiHandler } from "../src/api-handler.ts";
import { WRITER, fakeFoxing, fakeLog, freshEnv } from "./fakes.ts";

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc.example", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, ""),
);

describe("bindings", () => {
  test("are exactly the allowlist", () => {
    const keys = Object.keys(config).filter((k) =>
      [
        "d1_databases",
        "r2_buckets",
        "kv_namespaces",
        "services",
        "durable_objects",
        "queues",
        "ai",
        "vectorize",
        "hyperdrive",
        "analytics_engine_datasets",
        "secrets_store_secrets",
      ].includes(k),
    );
    assert.deepEqual(keys.sort(), ["durable_objects", "kv_namespaces", "r2_buckets", "services"]);
    assert.deepEqual(config.services, [{ binding: "FOXING", service: "foxing" }]);
    // The one bucket is this server's own copy of its tool-call log (L6), never one of Foxing's.
    assert.deepEqual(config.r2_buckets, [{ binding: "AUDIT_BUCKET", bucket_name: "foxing-admin-mcp-tool-calls" }]);
    assert.deepEqual(
      config.kv_namespaces.map((k: { binding: string }) => k.binding),
      ["OAUTH_KV"],
    );
    assert.deepEqual(
      config.durable_objects.bindings.map((b: { name: string }) => b.name).sort(),
      ["MCP_RATE_LIMIT", "TOOL_CALL_LOG"],
    );
  });

  test("no var or secret name mentions Stripe", () => {
    const text = readFileSync(new URL("../wrangler.jsonc.example", import.meta.url), "utf8");
    assert.doesNotMatch(Object.keys(config.vars).join(" "), /STRIPE/i);
    assert.doesNotMatch(text.replace(/\/\/.*$/gm, ""), /STRIPE/i);
  });
});

describe("imports", () => {
  test("src/ reaches nothing outside mcp/: no @foxing package, no ../../ path", () => {
    const dir = new URL("../src/", import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length >= 7, `read ${files.length} source files`);
    let read = 0;
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), "utf8");
      // from "x", a bare import "x", and a dynamic import("x").
      const specifiers = [
        ...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*)["']([^"']+)["']/g),
      ].map((m) => m[1]);
      read += specifiers.length;
      for (const spec of specifiers) {
        assert.ok(!spec.startsWith("@foxing/"), `${file} imports ${spec}`);
        assert.ok(!spec.startsWith("../"), `${file} imports ${spec}`);
      }
    }
    // Pair the check with what it read, so "no violations" cannot mean "nothing read".
    assert.ok(read >= 20, `read only ${read} import specifiers`);
  });
});

describe("apiHandler", () => {
  const ORIGIN = "https://admin-mcp.test";
  const env = () => ({
    ...freshEnv(fakeFoxing(), fakeLog()),
    PUBLIC_ORIGIN: ORIGIN,
    OAUTH_KV: {} as KVNamespace,
  });
  const request = () => new Request(`${ORIGIN}/mcp`, { method: "POST", body: "{}" });
  const ctxWith = (audience: string, props = WRITER.props) =>
    ({
      waitUntil() {},
      passThroughOnException() {},
      props,
      auth: { audience, scope: ["foxing.read"] },
    }) as unknown as ExecutionContext;

  test("PLANT 12.2: a token issued for another resource is refused", async () => {
    const response = await apiHandler.fetch(request(), env(), ctxWith("https://other.example/mcp"));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate") ?? "", /invalid_token/);
  });

  test("PLANT 12.1: a grant for another email is refused at the door", async () => {
    const response = await apiHandler.fetch(
      request(),
      env(),
      ctxWith(`${ORIGIN}/mcp`, { email: "someone-else@example.com" }),
    );
    assert.equal(response.status, 403);
    assert.match(await response.text(), /does not belong to its administrator/);
  });

  test("with the right audience and administrator, it reaches the rate limiter, which fails closed unbound and logs the refusal", async () => {
    const log = fakeLog();
    const response = await apiHandler.fetch(request(), { ...env(), TOOL_CALL_LOG: log.binding }, ctxWith(`${ORIGIN}/mcp`));
    assert.equal(response.status, 429);
    assert.deepEqual(
      log.rows.map((row) => [row.phase, row.caller]),
      [["rate-limited", `access:${WRITER.props.email}`]],
    );
  });
});
