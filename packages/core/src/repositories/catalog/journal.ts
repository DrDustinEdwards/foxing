// The Journal (editorial posts): /journal, /journal/:slug, /journal/rss.xml.
// Public reads are published-only.
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { journalPosts, journalSlugRedirects } from "../../schema";

export type JournalPost = typeof journalPosts.$inferSelect;

/**
 * The focal point Carrel set on the cover's file in the Journal's media library ("XxY"), or null
 * for a cover from elsewhere or with none: a cropped cover keeps that point in view.
 */
const coverFocus = sql<
  string | null
>`(SELECT m.focus FROM journal_media m WHERE substr(${journalPosts.coverImageUrl}, -length('/media/' || m.key)) = '/media/' || m.key)`;

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
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 12));
  const where = eq(journalPosts.isPublished, true);

  const posts = await db
    .select(CARD_COLUMNS)
    .from(journalPosts)
    .where(where)
    .orderBy(desc(journalPosts.featured), desc(journalPosts.publishedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const rows = await db.select({ slug: journalPosts.slug }).from(journalPosts).where(where);
  const total = rows.length;

  return {
    posts,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
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

/** Where a renamed post's old slug now leads (journal_slug_redirects, written by a Carrel rename), or null. */
export async function getJournalSlugRedirect(db: Db, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ toSlug: journalSlugRedirects.toSlug })
    .from(journalSlugRedirects)
    .where(eq(journalSlugRedirects.fromSlug, slug))
    .limit(1);
  return row?.toSlug ?? null;
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

/** Published posts carrying one tag, newest first. */
export async function listPostsByTag(
  db: Db,
  tag: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<JournalListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 24));
  const where = sql`journal_posts.is_published = 1
    AND EXISTS (SELECT 1 FROM json_each(journal_posts.tags) je WHERE je.value = ${tag})`;

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
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);
  const [{ n }] = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM journal_posts WHERE ${where}
  `);
  const total = Number(n);

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
      publishedAt: r.published_at ? new Date(r.published_at) : null,
      readingTimeMinutes: r.reading_time_minutes,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
