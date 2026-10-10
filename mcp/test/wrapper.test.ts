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
    assert.deepEqual(keys.sort(), ["durable_objects", "kv_namespaces", "services"]);
    assert.deepEqual(config.services, [{ binding: "FOXING", service: "foxing" }]);
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
    assert.ok(files.length >= 9, `read ${files.length} source files`);
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), "utf8");
      const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const spec of specifiers) {
        assert.ok(!spec.startsWith("@foxing/"), `${file} imports ${spec}`);
        assert.ok(!spec.startsWith("../"), `${file} imports ${spec}`);
      }
    }
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
    assert.equal(response.status, 403);
    assert.match(await response.text(), /not issued for Foxing Admin/);
  });

  test("PLANT 12.1: a grant for another GitHub account is refused at the door", async () => {
    const response = await apiHandler.fetch(
      request(),
      env(),
      ctxWith(`${ORIGIN}/mcp`, { id: 2002, login: "someone-else", name: null }),
    );
    assert.equal(response.status, 403);
    assert.match(await response.text(), /does not belong to its administrator/);
  });

  test("with the right audience and administrator, it reaches the rate limiter, which fails closed unbound", async () => {
    const response = await apiHandler.fetch(request(), env(), ctxWith(`${ORIGIN}/mcp`));
    assert.equal(response.status, 429);
  });
});
