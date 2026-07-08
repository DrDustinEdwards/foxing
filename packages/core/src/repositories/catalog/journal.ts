// The Journal (editorial posts): /journal, /journal/:slug, /journal/rss.xml.
// Public reads are published-only.
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db";
import { journalPosts } from "../../schema";

export type JournalPost = typeof journalPosts.$inferSelect;

export type JournalCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
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

export async function getPostBySlug(db: Db, slug: string): Promise<JournalPost | null> {
  const rows = await db
    .select()
    .from(journalPosts)
    .where(and(eq(journalPosts.slug, slug), eq(journalPosts.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
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
