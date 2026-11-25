// A Journal post's Markdown as HTML through Prelum's render (no math: `$` stays text). The output scan is on, so a body that renders outside the allowlist is refused. Shared by the journal route and Carrel's preview.
import { render } from "@drdustinedwards/site-helpers/render/nomath";
import type { Db } from "@foxing/core";
import { journalBodyImages } from "./journal-images.server";

export async function renderJournalBody(db: Db, slug: string, content: string): Promise<string> {
  const { resolveImage, media } = await journalBodyImages(db, content);
  const { html } = await render({
    file: `journal/${slug}`,
    body: content.replace(/([("])\/book\//g, "$1/books/"),
    resolveImage,
    options: { media, assertSafe: true },
  });
  return html;
}
