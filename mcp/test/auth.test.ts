import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { authorizeCall, callerName, isAdminUser } from "../src/auth.ts";
import { allowedRedirects, registrationRefusal } from "../src/registration.ts";

const props = { email: "admin@example.com" };

describe("isAdminUser", () => {
  test("matches the email without case, and nothing else", () => {
    assert.equal(isAdminUser({ ADMIN_EMAIL: "admin@example.com" }, props), true);
    assert.equal(isAdminUser({ ADMIN_EMAIL: " Admin@Example.com " }, props), true);
    assert.equal(isAdminUser({ ADMIN_EMAIL: "other@example.com" }, props), false);
    assert.equal(isAdminUser({ ADMIN_EMAIL: "admin@example.com" }, {}), false);
  });

  test("an unset administrator admits nobody", () => {
    assert.equal(isAdminUser({}, props), false);
    assert.equal(isAdminUser({ ADMIN_EMAIL: "  " }, props), false);
  });
});

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

describe("registrationRefusal (tightened DCR, rule 13)", () => {
  const allowed = "https://a.example/cb, https://b.example/cb";

  test("an empty allowlist refuses every registration", () => {
    assert.match(registrationRefusal("", { redirect_uris: ["https://a.example/cb"] }) ?? "", /closed/);
    assert.deepEqual(allowedRedirects(undefined), []);
  });

  test("every redirect URI must be listed exactly", () => {
    assert.equal(registrationRefusal(allowed, { redirect_uris: ["https://a.example/cb"] }), null);
    assert.match(
      registrationRefusal(allowed, { redirect_uris: ["https://a.example/cb", "https://a.example/cb2"] }) ?? "",
      /not allowlisted/,
    );
    assert.match(registrationRefusal(allowed, { redirect_uris: ["https://a.example/"] }) ?? "", /not allowlisted/);
  });

  test("a registration with no redirect URI is refused", () => {
    assert.match(registrationRefusal(allowed, {}) ?? "", /at least one/);
  });
});
