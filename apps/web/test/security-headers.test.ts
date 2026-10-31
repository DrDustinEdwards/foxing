// What the live check (site-runtime-security) cannot reach: the reader's own policy at
// /read/:slug, and a book's script file served so that it cannot run. The real Worker entry, the
// real root Layout and server entry (test/server-build.stub.ts), graded by the shared check.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { checkSecurityHeaders, failures } from "@dustinedwards/site-runtime/check";
import { describe, expect, it } from "vitest";
import worker from "../workers/app";
import { readerContentSecurityPolicy } from "../workers/security-headers";

const ORIGIN = "https://foxing.test";

const testEnv = {
  ...env,
  BETTER_AUTH_URL: ORIGIN,
  BETTER_AUTH_SECRET: "test-secret-value-for-headers-suite",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
} as unknown as Env;

async function fetchPath(path: string, init?: RequestInit) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`${ORIGIN}${path}`, init), testEnv, ctx);
  const body = await response.text();
  await waitOnExecutionContext(ctx);
  return { response, body };
}

/** The check's failures for these headers, by name. Empty is a pass. */
function failed(headers: Headers, options: { inlineStyles?: boolean } = {}): string[] {
  return failures(checkSecurityHeaders(headers, { site: "foxing", ...options })).map(
    (r) => `${r.name}: ${r.detail}`,
  );
}

function nonceOf(policy: string): string | undefined {
  return /'nonce-([^']+)'/.exec(policy)?.[1];
}

/** Every <script> the document has, with its nonce and whether it runs (JSON-LD does not). */
function scripts(html: string) {
  return [...html.matchAll(/<script\b([^>]*)>/g)].map(([, attrs = ""]) => ({
    nonce: /\snonce="([^"]*)"/.exec(attrs)?.[1],
    executable: !/type="application\/ld\+json"/.test(attrs),
  }));
}

describe("security headers the live check cannot reach", () => {
  it("the reader passes the check: blob: frames and base-uri 'self', scripts still nonce-only", async () => {
    const { response, body } = await fetchPath("/read/some-book");
    expect(response.status).toBe(200);
    // Only the reader keeps 'unsafe-inline' on style-src: Readium styles the book it renders inline.
    expect(failed(response.headers, { inlineStyles: true })).toEqual([]);
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    const nonce = nonceOf(policy);
    expect(policy).toBe(readerContentSecurityPolicy(nonce));
    expect(policy).toContain("frame-src 'self' blob:");
    expect(policy).toContain("base-uri 'self'");
    const scriptSrc = policy.split("; ").find((d) => d.startsWith("script-src ")) ?? "";
    expect(scriptSrc).not.toMatch(/blob:|'unsafe-inline'|'unsafe-eval'/);
    for (const s of scripts(body).filter((x) => x.executable)) expect(s.nonce).toBe(nonce);
  });

  it("a book's script file is served as text/plain, which nosniff refuses to run", async () => {
    await env.MEDIA.put("reader/sample-book/js/book.js", "window.ran = true;", {
      httpMetadata: { contentType: "text/javascript" },
    });
    const { response } = await fetchPath("/reader-assets/sample-book/js/book.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(failed(response.headers)).toEqual([]);
  });
});
