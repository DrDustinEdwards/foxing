import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { runReaderClean } from "../app/lib/reader-clean.server";

// A stored page whose XML declaration lost its closing "?" is rewritten with it, keeping its stored type; a
// page that is fine and a picture are left alone; a second run finds the done flag and touches nothing.
it("restores the lost ? in stored pages, keeps their type, and is done after one pass", async () => {
  await env.MEDIA.put(
    "reader/sample/ch1.xhtml",
    '<?xml version="1.0" encoding="utf-8">\n<html><p>Hi</p></html>',
    {
      httpMetadata: { contentType: "application/xhtml+xml" },
    },
  );
  await env.MEDIA.put("reader/sample/ch2.xhtml", '<?xml version="1.0" encoding="utf-8"?>\n<html/>');
  await env.MEDIA.put("reader/sample/cover.png", "bytes");

  expect(await runReaderClean(env)).toMatchObject({ done: true, rewritten: 1 });
  const page = await env.MEDIA.get("reader/sample/ch1.xhtml");
  expect(await page!.text()).toBe('<?xml version="1.0" encoding="utf-8"?>\n<html><p>Hi</p></html>');
  expect(page!.httpMetadata?.contentType).toBe("application/xhtml+xml");

  await env.MEDIA.put("reader/sample/ch3.xhtml", '<?xml version="1.0" encoding="utf-8">\n<html/>');
  expect(await runReaderClean(env)).toEqual({ done: true, listed: 0, rewritten: 0 });
});
