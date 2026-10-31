// A Journal post's Markdown as HTML, through Prelum's render as every site's writing is (no math:
// `$` stays text). The Journal stores no image sizes, so its images are written unsized. One place
// for the journal route and Carrel's preview, so a preview is the page's own body.
import { render } from "@drdustinedwards/site-helpers/render/nomath";

export async function renderJournalBody(slug: string, content: string): Promise<string> {
  const { html } = await render({
    file: `journal/${slug}`,
    body: content,
    resolveImage: async () => null,
  });
  return html;
}
