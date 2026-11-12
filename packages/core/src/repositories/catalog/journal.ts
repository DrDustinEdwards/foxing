// The Journal (editorial posts): /journal, /journal/:slug, /journal/rss.xml.
// Public reads are published-only.
import { toDate } from "@dustinedwards/site-runtime/time";
import { pageEnvelope } from "capsomer/behavior/pagination";
import { and, asc, desc, eq, getTableColumns, isNotNull, lte, sql } from "drizzle-orm";
import { clampPageSize } from "./page-size";
import type { Db } from "../../db";
import { journalPosts, journalSlugRedirects, profiles } from "../../schema";

export type JournalPost = typeof journalPosts.$inferSelect;

/**
 * The focal point Carrel set on the cover's file in the Journal's media library ("XxY"), or null
 * for a cover from elsewhere or with none: a cropped cover keeps that point in view.
 */
const coverFocus = sql<
  string | null
>`(SELECT m.focus FROM media m WHERE substr(${journalPosts.coverImageUrl}, -length('/media/' || m.key)) = '/media/' || m.key)`;

export type JournalCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  coverFocus: string | null;
  tags: string[] | null;
  featured: boolean;
  publishedAt: Date | null;
  readingTimeMinutes: number | null;
};

const CARD_COLUMNS = {
  slug: journalPosts.slug,
  title: journalPosts.title,
  excerpt: journalPosts.excerpt,
  coverImageUrl: journalPosts.coverImageUrl,
  coverImageAlt: journalPosts.coverImageAlt,
  coverFocus,
  tags: journalPosts.tags,
  featured: journalPosts.featured,
  publishedAt: journalPosts.publishedAt,
  readingTimeMinutes: journalPosts.readingTimeMinutes,
} as const;

export type JournalListResult = {
  posts: JournalCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listPublishedPosts(
  db: Db,
  opts: { page?: number; pageSize?: number } = {},
): Promise<JournalListResult> {
  const pageSize = clampPageSize(opts.pageSize, 48, 12);
  const where = eq(journalPosts.isPublished, true);

  const [counted] = await db
    .select({ n: sql<number>`count(*)` })
    .from(journalPosts)
    .where(where);
  const { page, perPage, pageCount, total, offset } = pageEnvelope(
    opts.page ?? 1,
    pageSize,
    Number(counted?.n ?? 0),
  );

  const posts = await db
    .select(CARD_COLUMNS)
    .from(journalPosts)
    .where(where)
    .orderBy(desc(journalPosts.featured), desc(journalPosts.publishedAt))
    .limit(perPage)
    .offset(offset);

  return { posts, total, page, pageSize: perPage, pageCount };
}

export async function getPostBySlug(
  db: Db,
  slug: string,
): Promise<(JournalPost & { coverFocus: string | null }) | null> {
  const rows = await db
    .select({ ...getTableColumns(journalPosts), coverFocus })
    .from(journalPosts)
    .where(and(eq(journalPosts.slug, slug), eq(journalPosts.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Where a renamed post's old slug now leads (journal_slug_redirects, written by a Carrel rename),
 * or null. Only a live post is led to, so the 301 never ends at a 404: while the post is a draft or
 * in the trash its old address answers 404 itself, and a delete removes the rows.
 */
export async function getJournalSlugRedirect(db: Db, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ toSlug: journalSlugRedirects.toSlug })
    .from(journalSlugRedirects)
    .innerJoin(journalPosts, eq(journalPosts.slug, journalSlugRedirects.toSlug))
    .where(and(eq(journalSlugRedirects.fromSlug, slug), eq(journalPosts.isPublished, true)))
    .limit(1);
  return row?.toSlug ?? null;
}

/**
 * The byline of a post: its credited staff member's display name, or null when it credits Foxing
 * alone.
 */
export async function getJournalAuthor(
  db: Db,
  post: { authorId: string | null },
): Promise<string | null> {
  if (!post.authorId) return null;
  const [person] = await db
    .select({ displayName: profiles.displayName, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, post.authorId))
    .limit(1);
  return person ? (person.displayName ?? person.username) : null;
}

export type JournalSeriesPart = JournalCard & { seriesPart: number | null };

/**
 * The live posts of one series, in reading order: by part number, a post with none after the
 * numbered ones, then by publish date. For a post's series nav and the series' own page.
 */
export async function listJournalSeriesParts(db: Db, series: string): Promise<JournalSeriesPart[]> {
  return db
    .select({ ...CARD_COLUMNS, seriesPart: journalPosts.seriesPart })
    .from(journalPosts)
    .where(and(eq(journalPosts.series, series), eq(journalPosts.isPublished, true)))
    .orderBy(
      sql`${journalPosts.seriesPart} IS NULL`,
      asc(journalPosts.seriesPart),
      asc(journalPosts.publishedAt),
    );
}

/** Each series on published posts with the newest change to one of its posts, for the sitemap. */
export async function listSitemapSeries(
  db: Db,
): Promise<Array<{ series: string; updatedAt: Date }>> {
  const rows = await db
    .select({
      series: journalPosts.series,
      updatedAt: sql<number>`MAX(${journalPosts.updatedAt})`,
    })
    .from(journalPosts)
    .where(
      and(
        isNotNull(journalPosts.series),
        eq(journalPosts.isPublished, true),
        eq(journalPosts.noindex, false),
      ),
    )
    .groupBy(journalPosts.series)
    .orderBy(asc(journalPosts.series));
  return rows.flatMap((r) =>
    r.series ? [{ series: r.series, updatedAt: new Date(Number(r.updatedAt)) }] : [],
  );
}

/**
 * Whether a slug names a post taken down on purpose: in Carrel's trash, and live once (published_at
 * in the past, which unpublishing keeps). Such an address answers 410, not 404, so a crawler drops
 * it and a reader is told it was not a typo. A draft trashed before it went live stays a 404.
 */
export async function isJournalPostWithdrawn(
  db: Db,
  slug: string,
  now: Date = new Date(),
): Promise<boolean> {
  const [row] = await db
    .select({ id: journalPosts.id })
    .from(journalPosts)
    .where(
      and(
        eq(journalPosts.slug, slug),
        eq(journalPosts.isPublished, false),
        isNotNull(journalPosts.trashedAt),
        lte(journalPosts.publishedAt, now),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** All published post slugs + last-modified, for the sitemap. */
export async function listPublishedSlugs(
  db: Db,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await db
    .select({ slug: journalPosts.slug, updatedAt: journalPosts.updatedAt })
    .from(journalPosts)
    // A post Carrel marked noindex stays on the Journal but out of the sitemap.
    .where(and(eq(journalPosts.isPublished, true), eq(journalPosts.noindex, false)))
    .orderBy(desc(journalPosts.publishedAt));
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt ?? new Date(0) }));
}

/** Latest published posts for the RSS feed and sitemap. */
export async function listRssPosts(db: Db, limit = 30): Promise<JournalPost[]> {
  return db
    .select()
    .from(journalPosts)
    .where(eq(journalPosts.isPublished, true))
    .orderBy(desc(journalPosts.publishedAt))
    .limit(limit);
}

export type JournalTag = { tag: string; count: number };

/** Distinct tags across published posts, for the tag index and archive filters. */
export async function listTags(db: Db): Promise<JournalTag[]> {
  const rows = await db.all<{ tag: string; count: number }>(sql`
    SELECT je.value AS tag, COUNT(*) AS count
    FROM journal_posts, json_each(journal_posts.tags) je
    WHERE journal_posts.is_published = 1 AND je.value IS NOT NULL AND je.value != ''
    GROUP BY je.value
    ORDER BY count DESC, tag ASC
  `);
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** Each tag on published posts with the newest change to a post that carries it, for the sitemap. */
export async function listSitemapTags(db: Db): Promise<Array<{ tag: string; updatedAt: Date }>> {
  const rows = await db.all<{ tag: string; updated_at: number }>(sql`
    SELECT je.value AS tag, MAX(journal_posts.updated_at) AS updated_at
    FROM journal_posts, json_each(journal_posts.tags) je
    WHERE journal_posts.is_published = 1 AND je.value IS NOT NULL AND je.value != ''
    GROUP BY je.value
    ORDER BY tag ASC
  `);
  return rows.map((r) => ({ tag: r.tag, updatedAt: new Date(Number(r.updated_at)) }));
}

/** Published posts carrying one tag, newest first. */
export async function listPostsByTag(
  db: Db,
  tag: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<JournalListResult> {
  const pageSize = clampPageSize(opts.pageSize, 48, 24);
  const where = sql`journal_posts.is_published = 1
    AND EXISTS (SELECT 1 FROM json_each(journal_posts.tags) je WHERE je.value = ${tag})`;

  const [{ n }] = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM journal_posts WHERE ${where}
  `);
  const { page, perPage, pageCount, total, offset } = pageEnvelope(
    opts.page ?? 1,
    pageSize,
    Number(n),
  );

  const rows = await db.all<{
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    cover_focus: string | null;
    tags: string;
    featured: number;
    published_at: number | null;
    reading_time_minutes: number | null;
  }>(sql`
    SELECT slug, title, excerpt, cover_image_url, cover_image_alt, ${coverFocus} AS cover_focus,
           tags, featured, published_at, reading_time_minutes
    FROM journal_posts
    WHERE ${where}
    ORDER BY featured DESC, published_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `);

  return {
    posts: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      coverImageUrl: r.cover_image_url,
      coverImageAlt: r.cover_image_alt,
      coverFocus: r.cover_focus,
      tags: JSON.parse(r.tags) as string[],
      featured: !!r.featured,
      publishedAt: toDate(r.published_at),
      readingTimeMinutes: r.reading_time_minutes,
    })),
    total,
    page,
    pageSize: perPage,
    pageCount,
  };
}
