// The one place a Journal row and Carrel's markdown file meet. Carrel edits a whole file: front
// matter for the row's fields, then the post's markdown body. Every field the file carries is listed
// in FIELDS; the slug is the content id and the published state is the row's status, so neither is
// in the file. site-api's six search fields are kept under its names (searchTitle, description,
// image, imageAlt, canonical, noindex), over the og_title, og_description, og_image_url,
// og_image_alt, canonical_url and noindex columns. Columns the file does not name (the show_*
// toggles, related_post_ids, reading_time_minutes) are never written through Carrel.
//
// Each front matter line is `key: value`, the value as JSON. A plain unquoted string is accepted
// for the text fields so a hand edit does not have to quote. A key the file leaves out is cleared,
// because the file is the whole post. The reader and writer are site-api's jsonSource.

import { JsonSourceError, jsonSource } from "@dustinedwards/site-api/frontmatter";

export type JournalFields = {
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  tags: string[];
  featured: boolean;
  /** site-api's search fields. */
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  content: string;
};

const SOURCE = jsonSource(
  {
    title: "text",
    excerpt: "text",
    cover_image_url: "text",
    cover_image_alt: "text",
    tags: "list",
    featured: "flag",
    searchTitle: "text",
    description: "text",
    image: "text",
    imageAlt: "text",
    canonical: "text",
    noindex: "flag",
  },
  { required: ["title"], blankLine: true },
);

/** The keys journal_post_versions keeps for an earlier version: the rest are not in history. */
export const HISTORY_KEYS = ["title", "excerpt"] as const;

export { JsonSourceError as JournalSourceError };

/** Writes a row's fields as Carrel's file. `only` limits the front matter to those keys. */
export function journalToSource(fields: JournalFields, only?: ReadonlyArray<string>): string {
  const values = {
    title: fields.title,
    excerpt: fields.excerpt,
    cover_image_url: fields.coverImageUrl,
    cover_image_alt: fields.coverImageAlt,
    tags: fields.tags,
    featured: fields.featured,
    // A blank search field or a false noindex is left out of the file, as site-api's setSearchFields leaves it.
    searchTitle: fields.ogTitle || undefined,
    description: fields.ogDescription || undefined,
    image: fields.ogImageUrl || undefined,
    imageAlt: fields.ogImageAlt || undefined,
    canonical: fields.canonicalUrl || undefined,
    noindex: fields.noindex || undefined,
  };
  const kept = only
    ? Object.fromEntries(Object.entries(values).filter(([k]) => only.includes(k)))
    : values;
  return SOURCE.write(kept, fields.content);
}

/** Reads Carrel's file back into the row's fields, or throws JournalSourceError naming every problem. */
export function sourceToJournal(source: string): JournalFields {
  const { values: v, body } = SOURCE.read(source);
  return {
    title: v.title ?? "",
    excerpt: v.excerpt ?? null,
    coverImageUrl: v.cover_image_url ?? null,
    coverImageAlt: v.cover_image_alt ?? null,
    tags: v.tags ?? [],
    featured: v.featured ?? false,
    ogTitle: v.searchTitle ?? null,
    ogDescription: v.description ?? null,
    ogImageUrl: v.image ?? null,
    ogImageAlt: v.imageAlt ?? null,
    canonicalUrl: v.canonical ?? null,
    noindex: v.noindex ?? false,
    content: body,
  };
}
