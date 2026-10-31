// Journal pictures from the media library, sized from their rows. A cover's address carries its
// bytes' hash, so a replace under the same key is a new URL and every size can be kept a year.
import type { ImageAttributes } from "@dustinedwards/site-runtime/image";
import { type Db, journalMediaRepo } from "@foxing/core";
import { images } from "./images";
import { SITE_ORIGIN } from "./origins";

const PATH = journalMediaRepo.JOURNAL_MEDIA_PATH;

/** The library key an address names (absolute on foxing.app, or a path), or null. */
function keyOf(url: string): string | null {
  const path = url.startsWith(SITE_ORIGIN) ? url.slice(SITE_ORIGIN.length) : url;
  return path.startsWith(`${PATH}journal/`) ? path.slice(PATH.length) : null;
}

/** Each cover address's attributes; one outside the library is written as it is, unsized. */
export async function journalCovers(
  db: Db,
  urls: Array<string | null>,
): Promise<Map<string, ImageAttributes>> {
  const keys = urls.flatMap((u) => (u && keyOf(u) ? [keyOf(u) as string] : []));
  const rows = new Map(
    (keys.length > 0 ? await journalMediaRepo.getJournalMediaMany(db, keys) : []).map((r) => [
      r.key,
      r,
    ]),
  );
  const out = new Map<string, ImageAttributes>();
  for (const url of urls) {
    if (!url) continue;
    const row = rows.get(keyOf(url) ?? "");
    const src = row ? `${PATH}${row.key}?v=${row.sha256.slice(0, 12)}` : url;
    out.set(
      url,
      images.attributes({ src, width: row?.width ?? null, height: row?.height ?? null }, "journal"),
    );
  }
  return out;
}

/** A body picture's size for Prelum's render, from its library row; null for one outside it. */
export async function journalImageSize(db: Db, src: string) {
  const key = keyOf(src);
  const row = key ? await journalMediaRepo.getJournalMedia(db, key) : null;
  return row?.width && row.height ? { width: row.width, height: row.height } : null;
}
