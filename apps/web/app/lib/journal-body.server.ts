// A Journal post's Markdown as HTML, through Prelum's render as every site's writing is (no math:
// `$` stays text). A picture from the media library is sized from its row and gets its AVIF and WebP sizes; any other is written
// unsized. The output scan is on, so a body that renders outside the allowlist is refused, not shown.
// One place for the journal route and Carrel's preview, so a preview is the page's own body.
import { render } from "@drdustinedwards/site-helpers/render/nomath";
import type { Db } from "@foxing/core";
import { journalBodyImages } from "./journal-images.server";

export async function renderJournalBody(db: Db, slug: string, content: string): Promise<string> {
  const { resolveImage, media } = await journalBodyImages(db, content);
  const { html } = await render({
    file: `journal/${slug}`,
    // Posts link books at the old /book/<slug>, which redirects; the link names the page itself.
    body: content.replace(/([("])\/book\//g, "$1/books/"),
    resolveImage,
    options: { media, assertSafe: true },
  });
  return html;
}
