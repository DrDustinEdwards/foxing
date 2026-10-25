// SEO helpers: canonical URLs, Open Graph / Twitter tags, and JSON-LD builders,
// all emitted through React Router's meta() so a route declares its SEO in one place.
//
// Canonical, OG and JSON-LD URLs always name https://foxing.app, never the request's
// origin: the workers.dev preview must not claim to be the page (Dustin, 2026-10-25).
// The JSON-LD builders and the IndexNow and robots helpers are Prelum's.
import { headTags, absoluteUrl as prelumAbsoluteUrl } from "@drdustinedwards/site-helpers/head";
import { article, breadcrumbs, itemList, thing } from "@drdustinedwards/site-helpers/schema";
import type { MetaDescriptor } from "react-router";
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

/** The site-wide share card (routes/og-site.tsx), for a page without a card of its own. */
const SITE_CARD = {
  url: "/og/site",
  width: 1200,
  height: 630,
  alt: "Foxing: read the classics, free.",
};

type MetaInput = {
  title: string;
  description?: string;
  pathname: string;
  /** Absolute or site-relative card image; without one the page shares the site card. */
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "book" | "profile";
  /** Set true to keep a page out of the index (community book pages). */
  noindex?: boolean;
};

/** The full standard head from Prelum's headTags: title, description, canonical, Open Graph, Twitter. */
export function buildMeta(input: MetaInput): MetaDescriptor[] {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    pathname,
    image,
    imageAlt,
    type,
    noindex,
  } = input;
  return headTags({
    origin: SITE_ORIGIN,
    path: pathname,
    title: pathname === "/" ? title : `${title} | ${SITE_NAME}`,
    description,
    image: image ? { url: image, alt: imageAlt } : SITE_CARD,
    siteName: SITE_NAME,
    type,
    noindex,
  });
}

/** Wrap a JSON-LD object as a meta descriptor React Router serializes into the head. */
export { jsonLd as ldJson } from "@drdustinedwards/site-helpers/schema";

export function breadcrumbLd(
  crumbs: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return breadcrumbs(SITE_ORIGIN, crumbs);
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
    image: book.coverUrl,
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
  publishedAt: Date | null;
  updatedAt: Date | null;
}): Record<string, unknown> {
  return article({
    url: absoluteUrl(`/journal/${post.slug}`),
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ?? undefined,
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
