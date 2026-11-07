// Catalog health: what is wrong with the books table, found from the rows alone (no network). Pure, so the
// rules are tested without a database; adminRepo.getCatalogHealth loads the rows.
//
// What a book catalog is checked for follows how book data is kept clean elsewhere: an ISBN is valid by its check
// digit (ISBN-10 mod 11, ISBN-13 mod 10; ISO 2108), a work is one record per edition (Open Library and Goodreads merge
// duplicates by ISBN and by normalized title plus author), a page needs the fields it shows (cover, description,
// year: what the search engines' Book markup and Foxing's own pages read), and a retailer link must go to the
// retailer. Catalog books (public domain, readable) are held to the page's fields; community books are reader-added
// from outside data and only checked for what they do have.

export type Severity = "error" | "warning";

export type CatalogCheck =
  | "missing_cover"
  | "cover_not_hosted"
  | "missing_description"
  | "missing_epub"
  | "missing_year"
  | "missing_subjects"
  | "invalid_isbn"
  | "isbn_mismatch"
  | "duplicate_isbn"
  | "duplicate_gutenberg_id"
  | "duplicate_title_author"
  | "bad_retailer_link";

type Scope = "all" | "catalog";

export const CATALOG_CHECKS: Record<
  CatalogCheck,
  { severity: Severity; scope: Scope; summary: string }
> = {
  missing_cover: {
    severity: "error",
    scope: "all",
    summary: "No cover image: the book shows a blank in lists, picks and share cards.",
  },
  cover_not_hosted: {
    severity: "warning",
    scope: "all",
    summary:
      "The cover is not on Foxing's own covers host, so it is not resized, cached or backed up by Foxing.",
  },
  missing_description: {
    severity: "error",
    scope: "catalog",
    summary: "A catalog book with no description: its page has no summary text.",
  },
  missing_epub: {
    severity: "error",
    scope: "catalog",
    summary: "A catalog book with no EPUB: it cannot be read in Foxing.",
  },
  missing_year: {
    severity: "warning",
    scope: "catalog",
    summary: "A catalog book with no publication year: it is left out of year and era views.",
  },
  missing_subjects: {
    severity: "warning",
    scope: "catalog",
    summary: "A catalog book with no subjects: it is left out of subject browsing.",
  },
  invalid_isbn: {
    severity: "error",
    scope: "all",
    summary: "An ISBN with the wrong length or a failing check digit.",
  },
  isbn_mismatch: {
    severity: "warning",
    scope: "all",
    summary: "The ISBN-10 and ISBN-13 on one book are not the same edition.",
  },
  duplicate_isbn: {
    severity: "error",
    scope: "all",
    summary:
      "Two or more books share one ISBN (ISBN-10 and ISBN-13 of one edition count as the same).",
  },
  duplicate_gutenberg_id: {
    severity: "error",
    scope: "all",
    summary: "Two or more books share one Project Gutenberg id.",
  },
  duplicate_title_author: {
    severity: "warning",
    scope: "all",
    summary:
      "Two or more books have the same title and author once case, accents, punctuation and a leading article are ignored. Different editions can be intended; check before merging.",
  },
  bad_retailer_link: {
    severity: "error",
    scope: "all",
    summary: "A Bookshop.org or Amazon link that is not https or does not go to that retailer.",
  },
};

export const CATALOG_CHECK_NAMES = Object.keys(CATALOG_CHECKS) as [CatalogCheck, ...CatalogCheck[]];

/** The columns the checks read. */
export type HealthBook = {
  id: string;
  title: string;
  author: string;
  slug: string;
  sourceType: string;
  coverUrl: string | null;
  description: string | null;
  epubUrl: string | null;
  isbn: string | null;
  isbn13: string | null;
  publicationYear: number | null;
  subjects: string[] | null;
  gutenbergId: number | null;
  amazonUrl: string | null;
  bookshopUrl: string | null;
};

export type Finding = {
  check: CatalogCheck;
  severity: Severity;
  bookId: string;
  title: string;
  author: string;
  slug: string;
  detail: string;
};

// ---- ISBN ---------------------------------------------------------------------

/** Digits (and a final X for an ISBN-10) with hyphens and spaces removed; "" for none. */
export function normalizeIsbn(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (isbn[i] === "X" ? 10 : Number(isbn[i])) * (10 - i);
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

/** The ISBN-13 of a valid ISBN-10 (978 prefix), or null. */
export function isbn10To13(isbn10: string): string | null {
  if (!isValidIsbn10(isbn10)) return null;
  const body = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/** The ISBN-13 a book is known by: its own, else its ISBN-10 converted; null when neither is valid. */
function canonicalIsbn(book: Pick<HealthBook, "isbn" | "isbn13">): string | null {
  const thirteen = normalizeIsbn(book.isbn13);
  if (isValidIsbn13(thirteen)) return thirteen;
  const ten = normalizeIsbn(book.isbn);
  if (isValidIsbn13(ten)) return ten;
  return isbn10To13(ten);
}

// ---- Titles -------------------------------------------------------------------

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "Austen, Jane" and "Jane Austen" are one author. */
function authorKey(author: string): string {
  const parts = author.split(",");
  return fold(parts.length === 2 ? `${parts[1]} ${parts[0]}` : author);
}

function titleKey(title: string): string {
  return fold(title).replace(/^(?:the|a|an) /, "");
}

// ---- Links --------------------------------------------------------------------

function linkIsOk(raw: string, host: RegExp): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && host.test(url.hostname);
  } catch {
    return false;
  }
}

const BOOKSHOP_HOST = /(?:^|\.)bookshop\.org$/i;
const AMAZON_HOST = /(?:^|\.)amazon\.[a-z.]+$|(?:^|\.)amzn\.(?:to|com)$/i;

// ---- The audit ----------------------------------------------------------------

const blank = (value: string | null | undefined) => !value || value.trim() === "";

/**
 * Every finding for `books`, errors first, then by title. `coverOrigin` is the host Foxing's own covers are served
 * from (https://covers.foxing.app), without a trailing slash.
 */
export function auditCatalog(books: HealthBook[], coverOrigin: string): Finding[] {
  const findings: Finding[] = [];
  const add = (book: HealthBook, check: CatalogCheck, detail: string) =>
    findings.push({
      check,
      severity: CATALOG_CHECKS[check].severity,
      bookId: book.id,
      title: book.title,
      author: book.author,
      slug: book.slug,
      detail,
    });

  for (const book of books) {
    const catalog = book.sourceType === "catalog";

    if (blank(book.coverUrl)) add(book, "missing_cover", "cover_url is empty.");
    else if (!book.coverUrl!.startsWith(`${coverOrigin}/`))
      add(book, "cover_not_hosted", `cover_url points to ${hostOf(book.coverUrl!)}.`);

    if (catalog) {
      if (blank(book.description)) add(book, "missing_description", "description is empty.");
      if (blank(book.epubUrl)) add(book, "missing_epub", "epub_url is empty.");
      if (book.publicationYear === null) add(book, "missing_year", "publication_year is empty.");
      if (!book.subjects || book.subjects.length === 0)
        add(book, "missing_subjects", "subjects is empty.");
    }

    const ten = normalizeIsbn(book.isbn);
    const thirteen = normalizeIsbn(book.isbn13);
    if (ten && !isValidIsbn10(ten) && !isValidIsbn13(ten))
      add(book, "invalid_isbn", `isbn "${book.isbn}" is not a valid ISBN-10 or ISBN-13.`);
    if (thirteen && !isValidIsbn13(thirteen))
      add(book, "invalid_isbn", `isbn13 "${book.isbn13}" is not a valid ISBN-13.`);
    if (isValidIsbn10(ten) && isValidIsbn13(thirteen) && isbn10To13(ten) !== thirteen)
      add(book, "isbn_mismatch", `isbn ${ten} is ISBN-13 ${isbn10To13(ten)}, not ${thirteen}.`);

    for (const [url, host, name] of [
      [book.bookshopUrl, BOOKSHOP_HOST, "bookshop_url"],
      [book.amazonUrl, AMAZON_HOST, "amazon_url"],
    ] as const) {
      if (!blank(url) && !linkIsOk(url!, host))
        add(book, "bad_retailer_link", `${name} "${url}" is not an https link to the retailer.`);
    }
  }

  groups(books, (b) => canonicalIsbn(b)).forEach((group, isbn) =>
    group.forEach((book) =>
      add(book, "duplicate_isbn", `ISBN-13 ${isbn} is shared with ${others(group, book)}.`),
    ),
  );
  groups(books, (b) => (b.gutenbergId === null ? null : String(b.gutenbergId))).forEach(
    (group, id) =>
      group.forEach((book) =>
        add(
          book,
          "duplicate_gutenberg_id",
          `Gutenberg id ${id} is shared with ${others(group, book)}.`,
        ),
      ),
  );
  groups(books, (b) => {
    const title = titleKey(b.title);
    return title ? `${title}|${authorKey(b.author)}` : null;
  }).forEach((group) =>
    group.forEach((book) =>
      add(book, "duplicate_title_author", `Same title and author as ${others(group, book)}.`),
    ),
  );

  return findings.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1) ||
      a.check.localeCompare(b.check) ||
      a.title.localeCompare(b.title) ||
      a.bookId.localeCompare(b.bookId),
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "an address that is not a URL";
  }
}

/** The groups of two or more books that share a key; books with no key are left out. */
function groups(books: HealthBook[], key: (book: HealthBook) => string | null) {
  const byKey = new Map<string, HealthBook[]>();
  for (const book of books) {
    const k = key(book);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), book]);
  }
  for (const [k, group] of byKey) if (group.length < 2) byKey.delete(k);
  return byKey;
}

const others = (group: HealthBook[], book: HealthBook) =>
  group
    .filter((b) => b.id !== book.id)
    .slice(0, 3)
    .map((b) => b.id)
    .join(", ") + (group.length > 4 ? ` and ${group.length - 4} more` : "");

/** Counts per check, in the order of CATALOG_CHECKS, with the checks that found nothing included as 0. */
export function summarize(findings: Finding[]) {
  return CATALOG_CHECK_NAMES.map((check) => ({
    check,
    severity: CATALOG_CHECKS[check].severity,
    count: findings.filter((f) => f.check === check).length,
    meaning: CATALOG_CHECKS[check].summary,
  }));
}
