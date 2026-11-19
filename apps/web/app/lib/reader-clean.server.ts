// Repairs the books already exploded into MEDIA under reader/. The first stored-book clean dropped the closing
// "?" of every XML declaration (<?xml ... ?> became <?xml ... >), so the reader's parser refused those pages. A pass
// lists reader/ from a cursor kept in KV (a small page, so the cursor is saved often and a pass never outruns the
// job timeout), restores the "?" in each page and SVG file that lost it (keeping its stored type), and stops at its
// time budget; run_job runs it again until it reports done, after which the trigger finds the flag and does nothing.
const CURSOR_KEY = "reader-clean-2:cursor";
const DONE_KEY = "reader-clean-2:done";
const PAGE = 100;
/** A processing instruction (the XML declaration, xml-stylesheet) that ends in ">" without its "?". */
const LOST_QUESTION_MARK = /<\?([\w-]+[^?>]*)>/g;
const BUDGET_MS = 120_000;

export async function runReaderClean(env: Pick<Env, "MEDIA" | "APP_KV">) {
  if (await env.APP_KV.get(DONE_KEY)) return { done: true, listed: 0, rewritten: 0 };
  const started = Date.now();
  let cursor = (await env.APP_KV.get(CURSOR_KEY)) ?? undefined;
  let listed = 0;
  let rewritten = 0;
  for (;;) {
    const page = await env.MEDIA.list({ prefix: "reader/", cursor, limit: PAGE });
    const results = await Promise.all(
      page.objects.map(async ({ key }) => {
        if (!/\.(?:x?html?|svg)$/i.test(key)) return false;
        const stored = await env.MEDIA.get(key);
        if (!stored) return false;
        const before = await stored.text();
        const after = before.replace(LOST_QUESTION_MARK, "<?$1?>");
        if (after === before) return false;
        await env.MEDIA.put(key, after, {
          httpMetadata: stored.httpMetadata,
          customMetadata: stored.customMetadata,
        });
        return true;
      }),
    );
    listed += page.objects.length;
    rewritten += results.filter(Boolean).length;
    cursor = page.truncated ? page.cursor : undefined;
    if (!cursor) {
      await env.APP_KV.put(DONE_KEY, new Date().toISOString());
      await env.APP_KV.delete(CURSOR_KEY);
      return { done: true, listed, rewritten };
    }
    await env.APP_KV.put(CURSOR_KEY, cursor);
    if (Date.now() - started > BUDGET_MS) return { done: false, listed, rewritten };
  }
}
