// Browse facets. Only facets backed by real catalog data are surfaced by the UI;
// mood/difficulty/language are wired but stay empty until enrichment populates them
// (verified live 2026-07-07: mood_tags/reading_difficulty/pacing are 100% null,
// language is single-valued 'en'). Era and length are derived buckets; genre is one of
// GENRES, read from the subjects json array (toGenres).
import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { cachedRead } from "../../kv-cache";

export type Bucket = { slug: string; label: string; min: number; max: number };

export const ERA_BUCKETS: Bucket[] = [
  { slug: "pre-1800", label: "Before 1800", min: -4000, max: 1799 },
  { slug: "1800-1849", label: "1800 to 1849", min: 1800, max: 1849 },
  { slug: "1850-1899", label: "1850 to 1899", min: 1850, max: 1899 },
  { slug: "1900-1949", label: "1900 to 1949", min: 1900, max: 1949 },
  { slug: "modern", label: "1950 and later", min: 1950, max: 3000 },
];

export const LENGTH_BUCKETS: Bucket[] = [
  { slug: "short", label: "Short, under 40k words", min: 0, max: 39_999 },
  { slug: "medium", label: "Medium, 40k to 120k", min: 40_000, max: 120_000 },
  { slug: "long", label: "Long, 120k and up", min: 120_001, max: 100_000_000 },
];

export function resolveEra(slug?: string | null): Bucket | undefined {
  return slug ? ERA_BUCKETS.find((b) => b.slug === slug) : undefined;
}

export function resolveLength(slug?: string | null): Bucket | undefined {
  return slug ? LENGTH_BUCKETS.find((b) => b.slug === slug) : undefined;
}

/**
 * The genres readers see: a fixed list. books.subjects holds these slugs for the catalog; a raw Library of
 * Congress heading ("Frankenstein's monster (Fictitious character) -- Fiction") is mapped onto one by
 * HEADING_GENRES, or left out, and never shown as a genre.
 */
export const GENRES = [
  { slug: "literary-fiction", label: "Literary fiction" },
  { slug: "mystery", label: "Mystery" },
  { slug: "adventure", label: "Adventure" },
  { slug: "fantasy", label: "Fantasy" },
  { slug: "drama", label: "Drama" },
  { slug: "romance", label: "Romance" },
  { slug: "science-fiction", label: "Science fiction" },
  { slug: "children", label: "Children's" },
  { slug: "biography", label: "Biography" },
  { slug: "historical-fiction", label: "Historical fiction" },
  { slug: "philosophy", label: "Philosophy" },
  { slug: "poetry", label: "Poetry" },
  { slug: "short-stories", label: "Short stories" },
  { slug: "humor", label: "Humor" },
  { slug: "horror", label: "Horror" },
] as const;

export type GenreSlug = (typeof GENRES)[number]["slug"];
export const GENRE_SLUGS = GENRES.map((g) => g.slug) as [GenreSlug, ...GenreSlug[]];

// Library of Congress form headings and subdivisions that name a genre, tested on the lowercased heading.
// A heading that names only a character, place or topic ("Monsters -- Fiction") maps to nothing.
const HEADING_GENRES: Array<[RegExp, GenreSlug]> = [
  [/juvenile (fiction|literature)|children's (stories|literature|poetry)/, "children"],
  [/^science fiction/, "science-fiction"],
  [/^(horror tales|gothic fiction)/, "horror"],
  [/^(detective and mystery stories|mystery fiction)/, "mystery"],
  [/^(adventure stories|sea stories)/, "adventure"],
  [/^(fantasy (fiction|literature)|fairy tales)/, "fantasy"],
  [/^(love stories|romance fiction)/, "romance"],
  [/^historical fiction/, "historical-fiction"],
  [/^(humorous stories|wit and humor)|-- humor$/, "humor"],
  [/^short stories/, "short-stories"],
  [/^(poetry|poems)|-- poetry$/, "poetry"],
  [/^(drama|tragedies|comedies)|-- drama$/, "drama"],
  [/^(biography|autobiographies)|-- biography$/, "biography"],
  [/^philosophy/, "philosophy"],
];

/** A book's subjects as genre slugs from GENRES, in their order, each once. */
export function toGenres(subjects: readonly string[] | null | undefined): GenreSlug[] {
  const out = new Set<GenreSlug>();
  for (const subject of subjects ?? []) {
    const s = subject.trim().toLowerCase();
    const slug = GENRE_SLUGS.find((g) => g === s) ?? HEADING_GENRES.find(([re]) => re.test(s))?.[1];
    if (slug) out.add(slug);
  }
  return [...out];
}

/** The reader-facing name of a genre slug. */
export function genreLabel(slug: string): string {
  return GENRES.find((g) => g.slug === slug)?.label ?? slug;
}

export type GenreFacet = { subject: GenreSlug; label: string; count: number };

/** The genres with books in the catalog, most books first, for the genre filter and genre chips. */
export function getGenreFacets(db: Db, limit = 32): Promise<GenreFacet[]> {
  // Counts every catalog book's subjects, called by most catalog pages: ten minutes stale is invisible.
  return cachedRead(db, `catalog:genre-facets:v2:${limit}`, 600, () => readGenreFacets(db, limit));
}

async function readGenreFacets(db: Db, limit: number): Promise<GenreFacet[]> {
  const rows = await db.all<{ subject: GenreSlug; count: number }>(sql`
    SELECT bs.subject AS subject, COUNT(*) AS count
    FROM book_subjects bs
    JOIN books ON books.id = bs.book_id
    WHERE books.source_type = 'catalog'
      AND bs.subject IN (${sql.join(
        GENRE_SLUGS.map((g) => sql`${g}`),
        sql`, `,
      )})
    GROUP BY bs.subject
    ORDER BY count DESC, subject ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    subject: r.subject,
    label: genreLabel(r.subject),
    count: Number(r.count),
  }));
}
