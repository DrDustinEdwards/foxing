// SEO helpers: canonical URLs, Open Graph / Twitter tags, and JSON-LD builders,
// all emitted through React Router's meta() so a route declares its SEO in one place.
//
// Canonical/OG URLs are built from the request origin passed down by the loader, so
// they are correct on the workers.dev preview AND on foxing.app after cutover, with
// no environment coupling.
import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Foxing";
export const DEFAULT_DESCRIPTION =
  "Foxing is a reading home for the classics: browse the catalog, follow literary awards and celebrity picks, and read the conversations around great books.";

export function absoluteUrl(origin: string, path: string): string {
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

type MetaInput = {
  title: string;
  description?: string;
  origin: string;
  pathname: string;
  /** Absolute or origin-relative OG image path (defaults to the site OG image). */
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "book" | "profile";
  /** Set true to keep a page out of the index (community book pages). */
  noindex?: boolean;
};

/** The full standard head: title, description, canonical, Open Graph, Twitter. */
export function buildMeta(input: MetaInput): MetaDescriptor[] {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    origin,
    pathname,
    image,
    imageAlt,
    type = "website",
    noindex,
  } = input;
  const canonical = absoluteUrl(origin, pathname);
  const fullTitle = pathname === "/" ? title : `${title} | ${SITE_NAME}`;
  const img = image ? (image.startsWith("http") ? image : absoluteUrl(origin, image)) : undefined;

  const tags: MetaDescriptor[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: type },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
  ];
  if (img) {
    tags.push({ property: "og:image", content: img });
    tags.push({ name: "twitter:image", content: img });
    if (imageAlt) tags.push({ property: "og:image:alt", content: imageAlt });
  }
  if (noindex) tags.push({ name: "robots", content: "noindex, follow" });
  return tags;
}

/** Wrap a JSON-LD object as a meta descriptor React Router serializes into the head. */
export function ldJson(schema: Record<string, unknown>): MetaDescriptor {
  return { "script:ld+json": schema };
}

export function breadcrumbLd(
  origin: string,
  crumbs: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(origin, c.path),
    })),
  };
}

export function bookLd(
  origin: string,
  book: {
    slug: string;
    title: string;
    author: string;
    authorSlug: string | null;
    description: string | null;
    coverUrl: string | null;
    publicationYear: number | null;
    isbn13: string | null;
    language: string | null;
  },
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    url: absoluteUrl(origin, `/books/${book.slug}`),
    author: {
      "@type": "Person",
      name: book.author,
      ...(book.authorSlug ? { url: absoluteUrl(origin, `/authors/${book.authorSlug}`) } : {}),
    },
    ...(book.description ? { description: book.description } : {}),
    ...(book.coverUrl ? { image: book.coverUrl } : {}),
    ...(book.publicationYear ? { datePublished: String(book.publicationYear) } : {}),
    ...(book.isbn13 ? { isbn: book.isbn13 } : {}),
    ...(book.language ? { inLanguage: book.language } : {}),
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export function articleLd(
  origin: string,
  post: {
    slug: string;
    title: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    publishedAt: Date | null;
    updatedAt: Date | null;
  },
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    url: absoluteUrl(origin, `/journal/${post.slug}`),
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt.toISOString() } : {}),
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export function itemListLd(
  origin: string,
  name: string,
  items: Array<{ title: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.title,
      url: absoluteUrl(origin, it.path),
    })),
  };
}
