// Where a Journal row and Carrel's markdown file meet: front matter for the row's fields (all listed in FIELDS), then the
// body. The slug and published state are not in the file; columns it does not name (show_*, related_post_ids,
// reading_time_minutes) are never written through Carrel. site-api's search fields keep its names over the og_* columns.
// Each front matter line is `key: value` as JSON (a plain string is accepted for text fields); a key the file leaves out is
// cleared, because the file is the whole post. The reader and writer are site-api's jsonSource.

import { JsonSourceError, jsonSource } from "@dustinedwards/site-api/frontmatter";

export type JournalFields = {
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  tags: string[];
  featured: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
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
    searchTitle: "text",
    description: "text",
    image: "text",
    imageAlt: "text",
    canonical: "text",
    noindex: "flag",
    authors: "list",
    series: "text",
    seriesPart: "text",
  },
  { required: ["title"], blankLine: true },
);

export const HISTORY_KEYS = ["title", "excerpt"] as const;

export { JsonSourceError as JournalSourceError };

export function journalToSource(fields: JournalFields, only?: ReadonlyArray<string>): string {
  const values = {
    title: fields.title,
    excerpt: fields.excerpt,
    cover_image_url: fields.coverImageUrl,
    cover_image_alt: fields.coverImageAlt,
    tags: fields.tags,
    featured: fields.featured,
    searchTitle: fields.ogTitle || undefined,
    description: fields.ogDescription || undefined,
    image: fields.ogImageUrl || undefined,
    imageAlt: fields.ogImageAlt || undefined,
    canonical: fields.canonicalUrl || undefined,
    noindex: fields.noindex || undefined,
    authors: fields.authors,
    series: fields.series,
    seriesPart: fields.seriesPart === null ? null : String(fields.seriesPart),
  };
  const kept = only
    ? Object.fromEntries(Object.entries(values).filter(([k]) => only.includes(k)))
    : values;
  return SOURCE.write(kept, fields.content);
}

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
    ogTitle: v.searchTitle ?? null,
    ogDescription: v.description ?? null,
    ogImageUrl: v.image ?? null,
    ogImageAlt: v.imageAlt ?? null,
    canonicalUrl: v.canonical ?? null,
    noindex: v.noindex ?? false,
    authors: v.authors ?? [],
    series: v.series ?? null,
    seriesPart: part === null ? null : Number(part),
    content: body,
  };
}
