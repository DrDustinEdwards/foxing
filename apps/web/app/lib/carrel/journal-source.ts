// The one place a Journal row and Carrel's markdown file meet. Carrel edits a whole file: front
// matter for the row's fields, then the post's markdown body. Every field the file carries is listed
// in FIELDS; the slug is the content id and the published state is the row's status, so neither is
// in the file. Columns the file does not name (og_title, og_description, canonical_url, the
// show_* toggles, related_post_ids, reading_time_minutes) are never written through Carrel.
//
// `authors`, `series` and `seriesPart` are site-api's shared post fields, under their shared names.
// authors holds display names: the adapter resolves the one Foxing credits to a staff account.
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
  authors: string[];
  series: string | null;
  seriesPart: number | null;
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
    authors: "list",
    series: "text",
    seriesPart: "text",
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
    authors: fields.authors,
    series: fields.series,
    seriesPart: fields.seriesPart === null ? null : String(fields.seriesPart),
  };
  const kept = only
    ? Object.fromEntries(Object.entries(values).filter(([k]) => only.includes(k)))
    : values;
  return SOURCE.write(kept, fields.content);
}

/** Reads Carrel's file back into the row's fields, or throws JournalSourceError naming every problem. */
export function sourceToJournal(source: string): JournalFields {
  const { values: v, body } = SOURCE.read(source);
  const part = v.seriesPart ?? null;
  if (part !== null && !/^[1-9]\d{0,4}$/.test(part))
    throw new JsonSourceError(["seriesPart must be a whole number, 1 or more."]);
  if (part !== null && !v.series)
    throw new JsonSourceError(["seriesPart needs a series: name the series it is a part of."]);
  return {
    title: v.title ?? "",
    excerpt: v.excerpt ?? null,
    coverImageUrl: v.cover_image_url ?? null,
    coverImageAlt: v.cover_image_alt ?? null,
    tags: v.tags ?? [],
    featured: v.featured ?? false,
    authors: v.authors ?? [],
    series: v.series ?? null,
    seriesPart: part === null ? null : Number(part),
    content: body,
  };
}
