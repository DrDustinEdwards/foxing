// Wire helpers: Dates leave core as epoch milliseconds, so loader data and JSON agree.
import type * as W from "@foxing/types";
import { inArray } from "drizzle-orm";
import { chunked, type Db } from "../db";
import { books } from "../schema";

export function ms(d: Date | null | undefined): number | null {
  return d ? d.getTime() : null;
}

/** Book references for any books (catalog or community), keyed by id. */
export async function bookRefs(db: Db, ids: (string | null)[]): Promise<Map<string, W.BookRef>> {
  const map = new Map<string, W.BookRef>();
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  for (const chunk of chunked(wanted)) {
    const rows = await db
      .select({
        id: books.id,
        slug: books.slug,
        title: books.title,
        author: books.author,
        coverUrl: books.coverUrl,
      })
      .from(books)
      .where(inArray(books.id, chunk));
    for (const r of rows) map.set(r.id, r);
  }
  return map;
}
