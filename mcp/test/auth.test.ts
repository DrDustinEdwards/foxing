import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { authorizeCall, callerName } from "../src/auth.ts";

const props = { email: "admin@example.com" };

describe("authorizeCall", () => {
  const env = { ADMIN_EMAIL: "admin@example.com" };

  test("the administrator with the scope passes", () => {
    assert.equal(authorizeCall(env, { kind: "admin", props, scopes: ["foxing.read"] }, "foxing.read"), null);
  });

  test("a read-only grant is refused a write, naming how to fix it", () => {
    const why = authorizeCall(env, { kind: "admin", props, scopes: ["foxing.read"] }, "foxing.write");
    assert.match(why ?? "", /read access only/);
  });

  test("an unset administrator refuses even a grant that once passed", () => {
    const why = authorizeCall({}, { kind: "admin", props, scopes: ["foxing.read"] }, "foxing.read");
    assert.match(why ?? "", /does not belong/);
  });

  test("no caller is refused", () => {
    assert.match(authorizeCall(env, undefined, "foxing.read") ?? "", /no caller identity/);
  });

  test("the audit name never carries a credential", () => {
    assert.equal(callerName({ kind: "admin", props, scopes: [] }), "access:admin@example.com");
  });
});
