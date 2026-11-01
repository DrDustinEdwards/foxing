// Journal pictures from the media library, sized from their rows. Every address carries the bytes'
// hash (`v`), so a replace under the same key is a new URL and every size can be kept a year.
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

/** A library row as site-runtime's StoredImage: its bytes' hash as the version (`v`), so a replace is a new URL. */
function stored(row: journalMediaRepo.JournalMediaRow) {
  return {
    src: `${PATH}${row.key}`,
    width: row.width,
    height: row.height,
    focus: row.focus,
    version: row.sha256,
    placeholder: row.placeholder,
    color: row.color,
  };
}

/**
 * Each cover address's attributes, with its focal point and the stored placeholder and color it shows while it
 * loads; one outside the library is written as it is, unsized.
 */
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
    out.set(
      url,
      images.attributes(row ? stored(row) : { src: url, width: null, height: null }, "journal"),
    );
  }
  return out;
}

/** The library keys a post's Markdown names, by their /media/journal/ paths. */
function keysIn(content: string): string[] {
  const found = content.match(/\/media\/journal\/[A-Za-z0-9._/-]+/g) ?? [];
  return [...new Set(found.flatMap((u) => (keyOf(u) ? [keyOf(u) as string] : [])))];
}

/**
 * Prelum's image options for a post's body: each library picture's size, and its AVIF and WebP sizes at the column's
 * width with a versioned link to the original. A picture outside the library is written unsized, as before. No
 * placeholder yet: Prelum writes one as a bare background-image (img.has-lqip), which needs Capsomer's picture.css
 * (0.57), and this site does not load that stylesheet yet.
 */
export async function journalBodyImages(db: Db, content: string) {
  const keys = keysIn(content);
  const rows = new Map(
    (keys.length > 0 ? await journalMediaRepo.getJournalMediaMany(db, keys) : []).map((r) => [
      r.key,
      r,
    ]),
  );
  const rowOf = (src: string) => rows.get(keyOf(src) ?? "");
  return {
    resolveImage: async (src: string) => {
      const row = rowOf(src);
      return row?.width && row.height ? { width: row.width, height: row.height } : null;
    },
    media: {
      keyOf,
      imageProps(src: string) {
        const row = rowOf(src);
        if (!row) return null;
        const attrs = images.attributes(stored(row), "journal");
        if (!attrs.srcset) return null;
        return {
          srcSet: attrs.srcset,
          sizes: attrs.sizes,
          href: images.url(`${PATH}${row.key}`, { version: row.sha256 }),
          // A GIF's reduced-motion stills are left out: this Prelum's <picture> writes no `media`, so a still would
          // win for every reader.
          sources: attrs.sources
            .filter((s) => !s.media)
            .map((s) => ({ type: s.type, srcSet: s.srcset })),
        };
      },
    },
  };
}
