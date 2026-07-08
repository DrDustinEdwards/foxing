// Affiliate buy links. Canonical retailer URLs are stored on the book (tags stripped
// at import, Phase 2); affiliate tags are appended here at render from config, never
// baked into stored URLs. Bookshop.org always ranks before Amazon (house rule 4).
// The rel="sponsored noopener noreferrer" attribute is applied by the render layer.

export type AffiliateConfig = {
  amazonTag?: string | null;
  bookshopId?: string | null;
};

export type BuyLink = {
  retailer: "bookshop" | "amazon";
  label: string;
  url: string;
};

export type BuyableBook = {
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

/** Ordered buy links (Bookshop first). Returns only the retailers we can build. */
export function buyLinks(book: BuyableBook, cfg: AffiliateConfig = {}): BuyLink[] {
  const links: BuyLink[] = [];

  // Bookshop: the /a/{affiliateId}/{isbn13} deep link is the affiliate form; otherwise
  // tag the stored canonical with ?aid.
  let bookshop: string | null = null;
  if (cfg.bookshopId && book.isbn13) {
    bookshop = `https://bookshop.org/a/${cfg.bookshopId}/${book.isbn13}`;
  } else if (book.bookshopUrl) {
    bookshop = cfg.bookshopId ? withParam(book.bookshopUrl, "aid", cfg.bookshopId) : book.bookshopUrl;
  }
  if (bookshop) links.push({ retailer: "bookshop", label: "Bookshop.org", url: bookshop });

  // Amazon: /dp needs an ASIN/ISBN-10, so only construct from a stored URL or isbn10.
  let amazonBase: string | null = book.amazonUrl ?? null;
  if (!amazonBase && book.isbn && book.isbn.replace(/-/g, "").length === 10) {
    amazonBase = `https://www.amazon.com/dp/${book.isbn.replace(/-/g, "")}`;
  }
  if (amazonBase) {
    const url = cfg.amazonTag ? withParam(amazonBase, "tag", cfg.amazonTag) : amazonBase;
    links.push({ retailer: "amazon", label: "Amazon", url });
  }

  return links;
}
