// Canonical retailer URLs are stored on the book; affiliate tags are appended here at render, never baked into stored URLs. A book with no
// canonical URL falls back to a title+author search. Bookshop.org always ranks before Amazon; the library link is last and not sponsored
// (rel="sponsored" is applied by Capsomer's ButtonLink for affiliate links).

export type AffiliateConfig = {
  amazonTag?: string | null;
  bookshopId?: string | null;
};

export type BuyLink = {
  retailer: "bookshop" | "amazon" | "library";
  label: string;
  url: string;
  sponsored: boolean;
};

export type BuyableBook = {
  title?: string | null;
  author?: string | null;
  bookshopUrl?: string | null;
  amazonUrl?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
};

function withParam(rawUrl: string, key: string, value: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export function buyLinks(book: BuyableBook, cfg: AffiliateConfig = {}): BuyLink[] {
  const q = [book.title, book.author].filter(Boolean).join(" ").trim();
  const search = q ? encodeURIComponent(q) : null;
  const links: BuyLink[] = [];

  // Bookshop: the /a/{affiliateId}/{isbn13} deep link is the affiliate form; otherwise
  // tag the stored canonical, otherwise a keyword search (best effort attribution).
  let bookshop: string | null = null;
  if (cfg.bookshopId && book.isbn13) {
    bookshop = `https://bookshop.org/a/${cfg.bookshopId}/${book.isbn13}`;
  } else if (book.bookshopUrl) {
    bookshop = cfg.bookshopId
      ? withParam(book.bookshopUrl, "aid", cfg.bookshopId)
      : book.bookshopUrl;
  } else if (search) {
    const base = `https://bookshop.org/beta-search?keywords=${search}`;
    bookshop = cfg.bookshopId ? withParam(base, "aid", cfg.bookshopId) : base;
  }
  if (bookshop)
    links.push({ retailer: "bookshop", label: "Bookshop.org", url: bookshop, sponsored: true });

  // Amazon: stored canonical, or /dp from an ISBN-10, or a keyword search. Tag appended.
  let amazon: string | null = book.amazonUrl ?? null;
  if (!amazon && book.isbn && book.isbn.replace(/-/g, "").length === 10) {
    amazon = `https://www.amazon.com/dp/${book.isbn.replace(/-/g, "")}`;
  }
  if (!amazon && search) amazon = `https://www.amazon.com/s?k=${search}&i=stripbooks`;
  if (amazon) {
    const url = cfg.amazonTag ? withParam(amazon, "tag", cfg.amazonTag) : amazon;
    links.push({ retailer: "amazon", label: "Amazon", url, sponsored: true });
  }

  // Library: WorldCat search (not affiliate). Only when we can build a query.
  if (search) {
    links.push({
      retailer: "library",
      label: "Find at a library",
      url: `https://search.worldcat.org/search?q=${search}`,
      sponsored: false,
    });
  }

  return links;
}
