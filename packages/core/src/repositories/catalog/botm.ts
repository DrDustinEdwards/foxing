// Book of the Month: Foxing's own monthly pick (/book-of-the-month). Distinct from
// external picks (/picks) and user clubs (/clubs) per the three-club-spaces rule.
import { sql } from "drizzle-orm";
import type { Db } from "../../db";

export type BotmEntry = {
  id: string;
  year: number;
  month: number;
  category: string | null;
  curatorNote: string | null;
  book: {
    slug: string;
    title: string;
    author: string;
    coverUrl: string | null;
    description: string | null;
    publicationYear: number | null;
  } | null;
};

const SELECT = sql`
  SELECT m.id, m.year, m.month, m.category, m.curator_note,
         b.slug AS b_slug, b.title, b.author, b.cover_url, b.description, b.publication_year
  FROM book_of_the_month m
  LEFT JOIN books b ON b.id = m.book_id
  WHERE m.is_published = 1
`;

type Row = {
  id: string;
  year: number;
  month: number;
  category: string | null;
  curator_note: string | null;
  b_slug: string | null;
  title: string | null;
  author: string | null;
  cover_url: string | null;
  description: string | null;
  publication_year: number | null;
};

function toEntry(r: Row): BotmEntry {
  return {
    id: r.id,
    year: r.year,
    month: r.month,
    category: r.category,
    curatorNote: r.curator_note,
    book: r.b_slug
      ? {
          slug: r.b_slug,
          title: r.title ?? "Untitled",
          author: r.author ?? "Unknown",
          coverUrl: r.cover_url,
          description: r.description,
          publicationYear: r.publication_year,
        }
      : null,
  };
}

export async function getCurrentBotm(db: Db): Promise<BotmEntry | null> {
  const rows = await db.all<Row>(sql`${SELECT} ORDER BY m.year DESC, m.month DESC LIMIT 1`);
  return rows[0] ? toEntry(rows[0]) : null;
}

export async function listBotm(db: Db): Promise<BotmEntry[]> {
  const rows = await db.all<Row>(sql`${SELECT} ORDER BY m.year DESC, m.month DESC`);
  return rows.map(toEntry);
}

export type TodaysPick = {
  source: "botm" | "staff";
  book: NonNullable<BotmEntry["book"]>;
  note: string | null;
};

type StaffRow = {
  slug: string;
  title: string;
  author: string;
  cover_url: string | null;
  description: string | null;
  publication_year: number | null;
  staff_pick_note: string | null;
};

/**
 * The homepage's featured-book slot. Prefers the published Book of the Month; when
 * none is published, falls back to a staff pick (books.is_staff_pick). Returns null
 * when neither source has a row, so the homepage section self-omits rather than
 * scaffolding a placeholder.
 */
export async function getTodaysPick(db: Db): Promise<TodaysPick | null> {
  const botm = await getCurrentBotm(db);
  if (botm?.book) return { source: "botm", book: botm.book, note: botm.curatorNote };

  const rows = await db.all<StaffRow>(sql`
    SELECT slug, title, author, cover_url, description, publication_year, staff_pick_note
    FROM books
    WHERE source_type = 'catalog' AND is_staff_pick = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    source: "staff",
    book: {
      slug: r.slug,
      title: r.title,
      author: r.author,
      coverUrl: r.cover_url,
      description: r.description,
      publicationYear: r.publication_year,
    },
    note: r.staff_pick_note,
  };
}
