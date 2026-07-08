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
  const rows = await db.all<Row>(
    sql`${SELECT} ORDER BY m.year DESC, m.month DESC LIMIT 1`,
  );
  return rows[0] ? toEntry(rows[0]) : null;
}

export async function listBotm(db: Db): Promise<BotmEntry[]> {
  const rows = await db.all<Row>(sql`${SELECT} ORDER BY m.year DESC, m.month DESC`);
  return rows.map(toEntry);
}
