// SEO helpers emitted through React Router's meta(). Canonical, OG and JSON-LD URLs always name https://foxing.app, never
// the request's origin: the workers.dev preview must not claim to be the page. The JSON-LD builders are Prelum's.
import { defineHead, absoluteUrl as prelumAbsoluteUrl } from "@drdustinedwards/site-helpers/head";
import {
  article,
  organization,
  pageImage,
  thing,
  website,
} from "@drdustinedwards/site-helpers/schema";
import type { MetaDescriptor } from "react-router";
import { COVER_SIZE } from "./images";
import { SITE_ORIGIN } from "./origins";

export const SITE_NAME = "Foxing";
const DEFAULT_DESCRIPTION =
  "Foxing is a reading home for the classics: browse the catalog, follow literary awards and celebrity picks, and read the conversations around great books.";

export function absoluteUrl(path: string): string {
  return prelumAbsoluteUrl(SITE_ORIGIN, path);
}

/** A journal tag's page; tags are free text, so the segment is encoded. */
export function journalTagPath(tag: string): string {
  return `/journal/tag/${encodeURIComponent(tag)}`;
}

export function journalSeriesPath(series: string): string {
  return `/journal/series/${encodeURIComponent(series)}`;
}

/** Prelum's head builder with the site share card; a long title drops the suffix and is cut at a word for search. */
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
  description: DEFAULT_DESCRIPTION,
  wholeHomeTitle: true,
  sections: { "/books": "Books", "/awards": "Awards", "/picks": "Picks", "/journal": "Journal" },
});

type MetaInput = {
  title: string;
  description?: string;
  pathname: string;
  image?: string | { url: string; width: number; height: number; type?: string };
  imageAlt?: string;
  type?: "website" | "article" | "book" | "profile";
  noindex?: boolean;
  canonical?: string;
  pageType?: string;
  breadcrumbs?: Array<{ name: string; path: string }>;
};

/** The route's lowercase address for a requested one (`/About` canonicalises to `/about`); only the first segment (and journal/archive|tag|series) is lowercased. */
function canonicalPathname(pathname: string): string {
  const parts = pathname.split("/");
  const lower =
    parts[1]?.toLowerCase() === "journal" && /^(archive|tag|series)$/i.test(parts[2] ?? "") ? 3 : 2;
  return [...parts.slice(0, lower).map((part) => part.toLowerCase()), ...parts.slice(lower)].join(
    "/",
  );
}

/** The full standard head from Prelum's defineHead; Prelum drops a trailing slash, so /x/ names /x as canonical. */
export function buildMeta({ pathname, ...page }: MetaInput): MetaDescriptor[] {
  return head({ ...page, path: canonicalPathname(pathname) });
}

export function noindexPageMeta(title: string): MetaDescriptor[] {
  return [{ title }, { name: "robots", content: "noindex" }];
}

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;

/** Foxing as an Organization on the home page, where Google reads its name and logo (the 512 px app icon). */
export function organizationLd(): Record<string, unknown> {
  return organization({
    id: ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: DEFAULT_DESCRIPTION,
    logo: pageImage({ url: absoluteUrl("/icon-512.png"), width: 512, height: 512 }),
  });
}

/** The site on the home page, where Google reads the site name. No SearchAction: /search is kept from crawlers. */
export function websiteLd(): Record<string, unknown> {
  return website({
    origin: SITE_ORIGIN,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    publisher: { "@id": ORGANIZATION_ID },
  });
}

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
  articleImages?: Array<{ url: string; width: number; height: number; creditText?: string }>;
  publishedAt: Date | null;
  updatedAt: Date | null;
  author?: string | null;
}): Record<string, unknown> {
  return article({
    url: absoluteUrl(`/journal/${post.slug}`),
    headline: post.title,
    description: post.excerpt,
    image: post.articleImages?.length
      ? post.articleImages
      : (post.coverImageUrl ?? absoluteUrl("/og/site")),
    published: post.publishedAt,
    modified: post.updatedAt,
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  });
}

/** Paths no crawler needs, in /robots.txt and /ai.txt alike: list sort and filter combinations multiply into near-duplicates. */
export const ROBOTS_DISALLOW = [
  "/me",
  "/onboarding",
  "/search",
  "/books?*era=",
  "/books?*length=",
  "/books?*sort=",
];
