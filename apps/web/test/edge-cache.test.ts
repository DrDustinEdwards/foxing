// The edge page cache's one rule Foxing owns (workers/app.ts): an anonymous GET of a public page
// leaves marked for the edge, and a signed-in request for the same page is stored nowhere, so a
// page rendered for one reader can never be handed to another.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../workers/app";

const testEnv = {
  ...env,
  BETTER_AUTH_URL: "https://foxing.test",
  BETTER_AUTH_SECRET: "test-secret-value-for-edge-cache-suite",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
} as unknown as Env;

async function fetchHome(headers?: HeadersInit) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request("https://foxing.test/", { headers }),
    testEnv,
    ctx,
  );
  await response.text();
  await waitOnExecutionContext(ctx);
  return response.headers;
}

describe("edge page cache", () => {
  it("an anonymous public page is shared at the edge; a signed-in one is stored nowhere", async () => {
    const anonymous = await fetchHome();
    expect(anonymous.get("Cache-Control")).toBe("public, max-age=0");
    expect(anonymous.get("Cloudflare-CDN-Cache-Control")).toMatch(/^max-age=\d+/);
    expect(anonymous.get("Cache-Tag")).toBe("pages");

    const signedIn = await fetchHome({ Cookie: "__Secure-better-auth.session_token=x" });
    expect(signedIn.get("Cache-Control")).toBe("private, no-store");
    expect(signedIn.get("Cloudflare-CDN-Cache-Control")).toBeNull();
    expect(signedIn.get("Cache-Tag")).toBeNull();
  });
});
