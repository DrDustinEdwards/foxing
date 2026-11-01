// SEO helpers: canonical URLs, Open Graph / Twitter tags, and JSON-LD builders,
// all emitted through React Router's meta() so a route declares its SEO in one place.
//
// Canonical, OG and JSON-LD URLs always name https://foxing.app, never the request's
// origin: the workers.dev preview must not claim to be the page (Dustin, 2026-10-25).
// The JSON-LD builders and the IndexNow and robots helpers are Prelum's.
import { defineHead, absoluteUrl as prelumAbsoluteUrl } from "@drdustinedwards/site-helpers/head";
import { article, itemList, pageImage, thing, website } from "@drdustinedwards/site-helpers/schema";
import type { MetaDescriptor } from "react-router";
import { COVER_SIZE } from "./images";
import { SITE_ORIGIN } from "./origins";

export const SITE_NAME = "Foxing";
const DEFAULT_DESCRIPTION =
  "Foxing is a reading home for the classics: browse the catalog, follow literary awards and celebrity picks, and read the conversations around great books.";

/** A path on foxing.app made absolute. */
export function absoluteUrl(path: string): string {
  return prelumAbsoluteUrl(SITE_ORIGIN, path);
}

/** A journal tag's page. Tags are free text, so the segment is encoded: a space or "&" in a
 *  tag would otherwise break the link and the sitemap. */
export function journalTagPath(tag: string): string {
  return `/journal/tag/${encodeURIComponent(tag)}`;
}

/** Prelum's head builder with the site-wide share card (routes/og-site.tsx), for a page without a card
 *  of its own. A long title drops the suffix and is cut at a word for search; the share card keeps it whole. */
const head = defineHead({
  origin: SITE_ORIGIN,
  siteName: SITE_NAME,
  image: {
    url: "/og/site",
    width: 1200,
    height: 630,
    type: "image/png",
    alt: "Foxing: read the classics, free.",
  },
  suffix: ` | ${SITE_NAME}`,
  // The sections a page's BreadcrumbList passes through; Prelum builds the only one a page has.
  sections: { "/books": "Books", "/awards": "Awards", "/picks": "Picks", "/journal": "Journal" },
});

type MetaInput = {
  title: string;
  description?: string;
  pathname: string;
  /** Absolute or site-relative card image, with its size where known; without one the page shares the site card. */
  image?: string | { url: string; width: number; height: number; type?: string };
  imageAlt?: string;
  type?: "website" | "article" | "book" | "profile";
  /** Set true to keep a page out of the index (community book pages, a Journal post Carrel marked noindex). */
  noindex?: boolean;
  /** An absolute canonical URL, where it is not this page's own (a Journal post's search field). */
  canonical?: string;
  /** "CollectionPage" for a list; WebPage otherwise. */
  pageType?: string;
  /** The trail from home, where it is not the one the URL's sections give. */
  breadcrumbs?: Array<{ name: string; path: string }>;
};

/** The full standard head from Prelum's defineHead: title, description, canonical, Open Graph, Twitter. */
export function buildMeta(input: MetaInput): MetaDescriptor[] {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    pathname,
    image,
    imageAlt,
    type,
    noindex,
    canonical,
    pageType,
    breadcrumbs,
  } = input;
  // Routes pass location.pathname, so /x/ would name /x/ as canonical; the page is /x.
  const path = pathname.replace(/\/+$/, "") || "/";
  return head({
    path,
    // The home page's title is already whole.
    title,
    fullTitle: path === "/",
    description,
    image: image
      ? { ...(typeof image === "string" ? { url: image } : image), alt: imageAlt }
      : undefined,
    type,
    noindex,
    canonical,
    pageType,
    breadcrumbs,
  });
}

/** Wrap a JSON-LD object as a meta descriptor React Router serializes into the head. */
export { jsonLd as ldJson } from "@drdustinedwards/site-helpers/schema";

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;

/** Foxing itself, on the home page, where Google reads an Organization's name and logo
 *  (https://developers.google.com/search/docs/appearance/structured-data/organization). The logo is the 512 px app icon. */
export function organizationLd(): Record<string, unknown> {
  return thing("Organization", {
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: DEFAULT_DESCRIPTION,
    logo: pageImage({ url: absoluteUrl("/icon-512.png"), width: 512, height: 512 }),
  });
}

/** The site, on the home page, where Google reads the site name
 *  (https://developers.google.com/search/docs/appearance/site-names). No SearchAction: /search is kept from crawlers. */
export function websiteLd(): Record<string, unknown> {
  return website({
    origin: SITE_ORIGIN,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    publisher: { "@id": ORGANIZATION_ID },
  });
}

/** The Journal as a Blog, published by Foxing, on /journal. */
export function journalLd(description: string): Record<string, unknown> {
  return thing("Blog", {
    "@id": `${absoluteUrl("/journal")}#blog`,
    name: "The Journal",
    url: absoluteUrl("/journal"),
    description,
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
  });
}

export function bookLd(book: {
  slug: string;
  title: string;
  author: string;
  authorSlug: string | null;
  description: string | null;
  coverUrl: string | null;
  publicationYear: number | null;
  isbn13: string | null;
  language: string | null;
}): Record<string, unknown> {
  return thing("Book", {
    name: book.title,
    url: absoluteUrl(`/books/${book.slug}`),
    author: {
      "@type": "Person",
      name: book.author,
      ...(book.authorSlug ? { url: absoluteUrl(`/authors/${book.authorSlug}`) } : {}),
    },
    description: book.description,
    image: book.coverUrl ? pageImage({ url: book.coverUrl, ...COVER_SIZE }) : undefined,
    datePublished: book.publicationYear ? String(book.publicationYear) : undefined,
    isbn: book.isbn13,
    inLanguage: book.language,
    publisher: { "@type": "Organization", name: SITE_NAME },
  });
}

export function articleLd(post: {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  /** The picture's Article crops (journalArticleImages), written in its place where it has them. */
  articleImages?: Array<{ url: string; width: number; height: number; creditText?: string }>;
  publishedAt: Date | null;
  updatedAt: Date | null;
}): Record<string, unknown> {
  return article({
    url: absoluteUrl(`/journal/${post.slug}`),
    headline: post.title,
    description: post.excerpt,
    image: post.articleImages?.length ? post.articleImages : (post.coverImageUrl ?? undefined),
    published: post.publishedAt,
    modified: post.updatedAt,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  });
}

export function itemListLd(
  name: string,
  items: Array<{ title: string; path: string }>,
): Record<string, unknown> {
  return itemList(
    SITE_ORIGIN,
    name,
    items.map((it) => ({ name: it.title, path: it.path })),
  );
}

/** Paths no crawler needs, in /robots.txt and /ai.txt alike. */
export const ROBOTS_DISALLOW = ["/me", "/onboarding", "/search", "/companion-test"];
