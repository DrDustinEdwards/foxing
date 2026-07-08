// Browse facets. Only facets backed by real catalog data are surfaced by the UI;
// mood/difficulty/language are wired but stay empty until enrichment populates them
// (verified live 2026-07-07: mood_tags/reading_difficulty/pacing are 100% null,
// language is single-valued 'en'). Era and length are derived buckets; genre comes
// from the subjects json array.
import { sql } from "drizzle-orm";
import type { Db } from "../../db";

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

export type GenreFacet = { subject: string; count: number };

/** Top subjects across the catalog, for the genre filter and genre chips. */
export async function getGenreFacets(db: Db, limit = 32): Promise<GenreFacet[]> {
  const rows = await db.all<{ subject: string; count: number }>(sql`
    SELECT je.value AS subject, COUNT(*) AS count
    FROM books, json_each(books.subjects) je
    WHERE books.source_type = 'catalog' AND je.value IS NOT NULL AND je.value != ''
    GROUP BY je.value
    ORDER BY count DESC, subject ASC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ subject: r.subject, count: Number(r.count) }));
}
