// A Journal post's Markdown as HTML, through Prelum's render as every site's writing is (no math:
// `$` stays text). A picture from the media library is sized from its row; any other is written
// unsized. One place for the journal route and Carrel's preview, so a preview is the page's own body.
import { render } from "@drdustinedwards/site-helpers/render/nomath";
import type { Db } from "@foxing/core";
import { journalImageSize } from "./journal-images.server";

export async function renderJournalBody(db: Db, slug: string, content: string): Promise<string> {
  const { html } = await render({
    file: `journal/${slug}`,
    body: content,
    resolveImage: (src) => journalImageSize(db, src),
  });
  return html;
}
