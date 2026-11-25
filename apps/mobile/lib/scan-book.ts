import type * as W from "@foxing/types";
import { findCatalogBook } from "./import";

export interface ResolvedMeta {
  title: string;
  author: string | null;
}

const GOOGLE_BOOKS = "https://www.googleapis.com/books/v1/volumes";

function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

async function googleBooksMeta(isbn: string): Promise<ResolvedMeta | null> {
  try {
    const res = await fetch(`${GOOGLE_BOOKS}?q=isbn:${isbn}&maxResults=1`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: Array<{ volumeInfo?: { title?: string; authors?: string[] } }>;
    };
    const info = json.items?.[0]?.volumeInfo;
    if (!info?.title) return null;
    return { title: info.title, author: info.authors?.[0] ?? null };
  } catch {
    return null;
  }
}

export async function resolveScannedIsbn(
  isbnRaw: string,
): Promise<
  | { ok: true; match: W.BookCard | null; resolved: ResolvedMeta | null }
  | { ok: false; error: string }
> {
  const isbn = cleanIsbn(isbnRaw);
  if (isbn.length !== 10 && isbn.length !== 13)
    return { ok: false, error: "ISBN must be 10 or 13 digits." };
  const resolved = await googleBooksMeta(isbn);
  if (!resolved) return { ok: true, match: null, resolved: null };
  const match = await findCatalogBook(resolved.title, resolved.author).catch(() => null);
  return { ok: true, match, resolved };
}
