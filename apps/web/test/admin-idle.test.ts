// The hour's idle sign-out on the browser admin APIs (workers/app.ts): a fetch() from an admin
// screen gets a 401 it can show, not the redirect to Access's logout, which fetch would follow
// and read as a success.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../workers/app";

const b64url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

describe("admin idle sign-out", () => {
  it("answers an idle admin's API call with a 401 the admin screens show", async () => {
    // adminIdle reads the Access token's iat without verifying it; two hours ago is idle.
    const iat = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
    const token = `${b64url({ alg: "RS256" })}.${b64url({ sub: "admin", iat })}.sig`;
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request("https://foxing.test/api/v1/admin/announcements", {
        method: "POST",
        headers: { "cf-access-jwt-assertion": token, "content-type": "application/json" },
        body: "{}",
      }),
      env as unknown as Env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("admin_idle");
  });
});
