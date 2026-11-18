import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { runReaderClean } from "../app/lib/reader-clean.server";

// The stored books' pages are rewritten once with the cleaner the explode script uses; a second run
// finds the done flag and touches nothing.
it("cleans stored pages in place, keeps their type, and is done after one pass", async () => {
  const dirty = '<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="https://example.com"></iframe>';
  await env.MEDIA.put("reader/sample/ch1.xhtml", dirty, {
    httpMetadata: { contentType: "application/xhtml+xml" },
  });
  await env.MEDIA.put("reader/sample/cover.png", "bytes");

  expect(await runReaderClean(env)).toMatchObject({ done: true, rewritten: 1 });
  const page = await env.MEDIA.get("reader/sample/ch1.xhtml");
  const text = await page!.text();
  expect(text).toContain("Hi");
  expect(text).not.toMatch(/script|iframe|onclick/);
  expect(page!.httpMetadata?.contentType).toBe("application/xhtml+xml");

  await env.MEDIA.put("reader/sample/ch2.xhtml", dirty);
  expect(await runReaderClean(env)).toEqual({ done: true, listed: 0, rewritten: 0 });
});
