// External book clubs (celebrity / retailer picks): /picks + /picks/:clubSlug.
// Picks mostly reference modern in-copyright titles (community books), so the book
// join is NOT catalog-scoped here; the linked /books/:slug page resolves community
// books too (noindex). This is the primary affiliate surface.
import { sql } from "drizzle-orm";
import type { Db } from "../../db";

export type ClubSummary = {
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  curator: string | null;
  logoUrl: string | null;
  focus: string | null;
  pickCount: number;
};

export type PickBook = {
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  publicationYear: number | null;
} | null;

export type PickEntry = {
  id: string;
  pickYear: number | null;
  pickMonth: number | null;
  category: string | null;
  curatorQuote: string | null;
  notes: string | null;
  officialUrl: string | null;
  book: PickBook;
};

export type ClubDetail = ClubSummary & { picks: PickEntry[] };

export async function listExternalClubs(db: Db): Promise<ClubSummary[]> {
  const rows = await db.all<{
    slug: string;
    name: string;
    short_name: string;
    description: string | null;
    curator: string | null;
    logo_url: string | null;
    focus: string | null;
    pick_count: number;
  }>(sql`
    SELECT c.slug, c.name, c.short_name, c.description, c.curator, c.logo_url, c.focus,
           COUNT(p.id) AS pick_count
    FROM external_book_clubs c
    LEFT JOIN external_book_club_picks p ON p.club_id = c.id AND p.is_published = 1
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order ASC, pick_count DESC
  `);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    shortName: r.short_name,
    description: r.description,
    curator: r.curator,
    logoUrl: r.logo_url,
    focus: r.focus,
    pickCount: Number(r.pick_count),
  }));
}

export async function getClubBySlug(db: Db, slug: string): Promise<ClubDetail | null> {
  const club = await db.all<{
    id: string;
    slug: string;
    name: string;
    short_name: string;
    description: string | null;
    curator: string | null;
    logo_url: string | null;
    focus: string | null;
  }>(sql`
    SELECT id, slug, name, short_name, description, curator, logo_url, focus
    FROM external_book_clubs WHERE slug = ${slug} AND is_active = 1 LIMIT 1
  `);
  if (club.length === 0) return null;
  const c = club[0];

  const rows = await db.all<{
    id: string;
    pick_year: number | null;
    pick_month: number | null;
    category: string | null;
    curator_quote: string | null;
    notes: string | null;
    official_url: string | null;
    b_slug: string | null;
    title: string | null;
    author: string | null;
    cover_url: string | null;
    publication_year: number | null;
  }>(sql`
    SELECT p.id, p.pick_year, p.pick_month, p.category, p.curator_quote, p.notes, p.official_url,
           b.slug AS b_slug, b.title, b.author, b.cover_url, b.publication_year
    FROM external_book_club_picks p
    LEFT JOIN books b ON b.id = p.book_id
    WHERE p.club_id = ${c.id} AND p.is_published = 1
    ORDER BY p.pick_year DESC NULLS LAST, p.pick_month DESC NULLS LAST, p.created_at DESC
  `);

  return {
    slug: c.slug,
    name: c.name,
    shortName: c.short_name,
    description: c.description,
    curator: c.curator,
    logoUrl: c.logo_url,
    focus: c.focus,
    pickCount: rows.length,
    picks: rows.map((r) => ({
      id: r.id,
      pickYear: r.pick_year,
      pickMonth: r.pick_month,
      category: r.category,
      curatorQuote: r.curator_quote,
      notes: r.notes,
      officialUrl: r.official_url,
      book: r.b_slug
        ? {
            slug: r.b_slug,
            title: r.title ?? "Untitled",
            author: r.author ?? "Unknown",
            coverUrl: r.cover_url,
            publicationYear: r.publication_year,
          }
        : null,
    })),
  };
}
