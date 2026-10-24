// The security headers on rendered responses (workers/security-headers.ts): the real Worker entry,
// the real root Layout and server entry (test/server-build.stub.ts), graded by the shared
// package's own check. Every kind of response the Worker sends is here: a page, a cache hit of
// that page, the reader, a redirect, a 404, the API, an image, and the report sink.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { checkSecurityHeaders, failures } from "@dustinedwards/site-runtime/check";
import { describe, expect, it } from "vitest";
import worker from "../workers/app";
import {
  contentSecurityPolicy,
  readerContentSecurityPolicy,
  securityHeaders,
} from "../workers/security-headers";

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
function failed(headers: Headers, csp = true): string[] {
  return failures(
    checkSecurityHeaders(headers, { standard: securityHeaders, csp, cloudflareWebAnalytics: true }),
  ).map((r) => `${r.name}: ${r.detail}`);
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

describe("security headers on rendered responses", () => {
  it("a page passes the check, with an enforced policy whose nonce is on every script it renders", async () => {
    const { response, body } = await fetchPath("/");
    expect(response.status).toBe(200);
    expect(failed(response.headers)).toEqual([]);
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
    expect(policy).not.toContain("'unsafe-inline' ");
    const nonce = nonceOf(policy);
    expect(nonce).toBeTruthy();
    const executable = scripts(body).filter((s) => s.executable);
    // The no-flash theme script, React Router's context and module scripts at the least.
    expect(executable.length).toBeGreaterThanOrEqual(3);
    for (const s of executable) expect(s.nonce).toBe(nonce);
    expect(response.headers.get("Reporting-Endpoints")).toBe(
      `csp-endpoint="${ORIGIN}/api/csp-report"`,
    );
  });

  it("a cache hit gets a fresh nonce, in its header and on every script, so readers never share one", async () => {
    const first = await fetchPath("/");
    const second = await fetchPath("/");
    expect(failed(second.response.headers)).toEqual([]);
    const a = nonceOf(first.response.headers.get("Content-Security-Policy") ?? "");
    const b = nonceOf(second.response.headers.get("Content-Security-Policy") ?? "");
    expect(b).toBeTruthy();
    expect(b).not.toBe(a);
    for (const s of scripts(second.body).filter((x) => x.executable)) expect(s.nonce).toBe(b);
    expect(second.body).not.toContain(`nonce="${a}"`);
  });

  it("the reader passes the check: blob: frames and base-uri 'self', scripts still nonce-only", async () => {
    const { response, body } = await fetchPath("/read/some-book");
    expect(response.status).toBe(200);
    expect(failed(response.headers)).toEqual([]);
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    const nonce = nonceOf(policy);
    expect(policy).toBe(readerContentSecurityPolicy(nonce));
    expect(policy).toContain("frame-src 'self' blob:");
    expect(policy).toContain("base-uri 'self'");
    const scriptSrc = policy.split("; ").find((d) => d.startsWith("script-src ")) ?? "";
    expect(scriptSrc).not.toMatch(/blob:|'unsafe-inline'|'unsafe-eval'/);
    for (const s of scripts(body).filter((x) => x.executable)) expect(s.nonce).toBe(nonce);
  });

  it("a redirect carries the set and the policy", async () => {
    const { response } = await fetchPath("/sign-in", { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(failed(response.headers)).toEqual([]);
    expect(response.headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy());
  });

  it("a 404 page passes the check", async () => {
    const { response } = await fetchPath("/no-such-page");
    expect(response.status).toBe(404);
    expect(failed(response.headers)).toEqual([]);
  });

  it("the API passes the check", async () => {
    const { response } = await fetchPath("/api/auth/get-session");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(failed(response.headers)).toEqual([]);
    const v1 = await fetchPath("/api/v1/no-such-route");
    expect(failed(v1.response.headers)).toEqual([]);
  });

  it("an image is the one deviation: Cross-Origin-Resource-Policy cross-origin, for link previews", async () => {
    const response = new Response("x", { headers: { "Content-Type": "image/png" } });
    const { withSecurityHeaders } = await import("../workers/security-headers");
    const out = withSecurityHeaders(response, new Request(`${ORIGIN}/og/book/x`));
    expect(out.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    expect(out.headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy());
    expect(
      failed(out.headers).filter((f) => !f.startsWith("Cross-Origin-Resource-Policy")),
    ).toEqual([]);
  });

  it("the report sink accepts both report formats and answers 204", async () => {
    const legacy = await fetchPath("/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": `${ORIGIN}/books`,
          "violated-directive": "script-src",
          "blocked-uri": "inline",
        },
      }),
    });
    expect(legacy.response.status).toBe(204);
    const reportTo = await fetchPath("/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify([{ type: "csp-violation", body: { documentURL: `${ORIGIN}/` } }]),
    });
    expect(reportTo.response.status).toBe(204);
  });

  it("a book's script file is served as text/plain, which nosniff refuses to run", async () => {
    await env.MEDIA.put("reader/sample-book/js/book.js", "window.ran = true;", {
      httpMetadata: { contentType: "text/javascript" },
    });
    const { response } = await fetchPath("/reader-assets/sample-book/js/book.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(failed(response.headers)).toEqual([]);
  });
});
