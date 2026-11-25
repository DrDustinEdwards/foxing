import {
  contentVersion,
  RefusedError,
  ContentTag,
  type ContentStatus,
  type ContentSummary,
  type ListQuery,
  type Revision,
} from "@dustinedwards/site-api";
import { adminRepo, type catalogRepo } from "@foxing/core";
import type { JournalPreview } from "../../context";
import { JournalSourceError, sourceToJournal, type JournalFields } from "./journal-source";

export type JournalPost = catalogRepo.JournalPost;

export const FOXING = "Foxing";

export const KIND = "journal";

export const UNSAVED_PREVIEW_SLUG = "carrel-preview";

/** Addresses under /journal/ that a route answers before any post, so no post may take one. */
const RESERVED_SLUGS = new Set(["archive", "tag"]);

/** An earlier version's id, from journal_post_versions: distinct from a current version's digits. */
export const REVISION_PREFIX = "r-";

const EVENT_MESSAGE: Record<string, string> = {
  save: "The post before a save.",
  publish: "The post before it was published.",
  unpublish: "The post before it was taken off the Journal.",
  rename: "The post before it was renamed, at its old address.",
};

export function blankPost(slug: string): JournalPost {
  const now = new Date();
  return {
    id: UNSAVED_PREVIEW_SLUG,
    title: "",
    slug,
    content: "",
    excerpt: null,
    coverImageUrl: null,
    coverImageAlt: null,
    authorId: null,
    tags: null,
    relatedPostIds: null,
    featured: false,
    isPublished: false,
    publishedAt: null,
    showPublishedAt: true,
    showUpdatedAt: true,
    ogTitle: null,
    ogDescription: null,
    ogImageUrl: null,
    ogImageAlt: null,
    canonicalUrl: null,
    noindex: false,
    readingTimeMinutes: null,
    series: null,
    seriesPart: null,
    trashedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export type Pending = { publishAt: string; changeId: string } | null;

/** A post's version: its updated_at in milliseconds, which every Journal write moves forward, and its schedule's. */
export async function versionOf(row: { updatedAt: Date }, pending: Pending): Promise<string> {
  const updated = String(row.updatedAt.getTime());
  if (!pending) return updated;
  return `${updated}.${(await contentVersion([pending.publishAt, pending.changeId])).slice(0, 16)}`;
}

function iso(at: Date | null | undefined): string | null {
  return at ? at.toISOString() : null;
}

function statusOf(row: { isPublished: boolean }, pending: Pending): ContentStatus {
  if (row.isPublished) return "published";
  return pending ? "scheduled" : "draft";
}

export function fieldsOf(row: JournalPost, author: string): JournalFields {
  return {
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    tags: row.tags ?? [],
    featured: row.featured,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageUrl: row.ogImageUrl,
    ogImageAlt: row.ogImageAlt,
    canonicalUrl: row.canonicalUrl,
    noindex: row.noindex,
    authors: [author],
    series: row.series,
    seriesPart: row.seriesPart,
    content: row.content,
  };
}

export function readSource(source: string): JournalFields {
  try {
    return sourceToJournal(source);
  } catch (error) {
    if (error instanceof JournalSourceError) throw new RefusedError(error.message);
    throw error;
  }
}

const FILE_KEY: Record<string, string> = {
  seriesPart: "seriesPart",
  coverImageUrl: "cover_image_url",
  coverImageAlt: "cover_image_alt",
  ogTitle: "searchTitle",
  ogDescription: "description",
  ogImageUrl: "image",
  ogImageAlt: "imageAlt",
  canonicalUrl: "canonical",
  content: "the body",
  slug: "the id (slug)",
};

export function validated(slug: string, fields: JournalFields) {
  if (RESERVED_SLUGS.has(slug))
    throw new RefusedError(
      `/journal/${slug} is a Journal page of its own, so no post can take it.`,
    );
  const parsed = adminRepo.journalInput.safeParse({ slug, ...fields });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const field = String(issue.path[0] ?? "post");
      return `- ${FILE_KEY[field] ?? field}: ${issue.message}`;
    });
    throw new RefusedError(["The Journal refused this post:", ...lines].join("\n"));
  }
  const { slug: _slug, isPublished: _isPublished, ...values } = parsed.data;
  return values;
}

export async function summaryOf(
  row: {
    slug: string;
    title: string;
    excerpt: string | null;
    tags: string[] | null;
    isPublished: boolean;
    publishedAt: Date | null;
    updatedAt: Date;
    trashedAt: Date | null;
  },
  pending: Pending,
  author?: string,
): Promise<ContentSummary> {
  const status = statusOf(row, pending);
  return {
    id: row.slug,
    kind: KIND,
    title: row.title,
    status,
    path: status === "published" ? `/journal/${row.slug}` : null,
    publishAt: status === "scheduled" ? (pending?.publishAt ?? null) : null,
    publishedAt: status === "published" ? iso(row.publishedAt) : null,
    updatedAt: iso(row.updatedAt),
    version: await versionOf(row, pending),
    scheduledUpdate: row.isPublished && pending ? { ...pending } : null,
    // Only tags the contract can carry, so one odd tag never fails the list.
    tags: (row.tags ?? []).filter((t) => ContentTag.safeParse(t).success),
    ...(author ? { authors: [author] } : {}),
    ...(row.excerpt ? { excerpt: row.excerpt } : {}),
    trashedAt: iso(row.trashedAt),
  };
}

export function listFilter(
  query: ListQuery,
  scheduled: string[],
  authorId: string | null | undefined,
): adminRepo.JournalAdminQuery {
  return {
    authorId,
    published: query.status === undefined ? undefined : query.status === "published",
    // A scheduled post is a draft with a schedule waiting; a draft has none.
    ...(query.status === "scheduled" ? { slugs: scheduled } : {}),
    ...(query.status === "draft" ? { exceptSlugs: scheduled } : {}),
    q: query.q,
    tag: query.tag,
    publishedAfter: query.publishedAfter ? new Date(query.publishedAfter) : undefined,
    publishedBefore: query.publishedBefore ? new Date(query.publishedBefore) : undefined,
    trashed: query.trashed ?? false,
  };
}

export function notTrashed(row: { trashedAt: Date | null }) {
  if (row.trashedAt) throw new RefusedError("This post is in the trash. Restore it first.");
}

export const creditOf = (names: Map<string, string>, authorId: string | null) =>
  (authorId && names.get(authorId)) || FOXING;

export function revisionItems(
  row: JournalPost,
  earlier: Awaited<ReturnType<typeof adminRepo.listJournalVersions>>,
  names: Map<string, string>,
  currentVersion: string,
): Revision[] {
  const current = creditOf(names, row.authorId);
  return [
    {
      version: currentVersion,
      at: row.updatedAt.toISOString(),
      author: current,
      authors: [current],
      message: "The post as it stands now.",
    },
    ...earlier.map((v) => {
      const credited = creditOf(names, v.fields ? v.authorId : row.authorId);
      const by = v.savedBy ? (names.get(v.savedBy) ?? "A removed account") : credited;
      return {
        version: `${REVISION_PREFIX}${v.id}`,
        at: v.savedAt.toISOString(),
        author: by.slice(0, 200),
        authors: [credited],
        message: v.fields
          ? `${EVENT_MESSAGE[v.event ?? "save"] ?? EVENT_MESSAGE.save} Every field is kept.`
          : "The text before a save. This older version kept the title, excerpt and body; the rest is as it is now.",
      };
    }),
  ];
}

export function previewPost(
  stored: JournalPost | null,
  slug: string,
  values: ReturnType<typeof validated> & { authorId: string | null },
): JournalPreview {
  return {
    ...(stored ?? blankPost(slug)),
    title: values.title,
    content: values.content,
    excerpt: values.excerpt ?? null,
    coverImageUrl: values.coverImageUrl ?? null,
    coverImageAlt: values.coverImageAlt ?? null,
    tags: values.tags ?? null,
    featured: values.featured ?? false,
    ogTitle: values.ogTitle ?? null,
    ogDescription: values.ogDescription ?? null,
    ogImageUrl: values.ogImageUrl ?? null,
    ogImageAlt: values.ogImageAlt ?? null,
    canonicalUrl: values.canonicalUrl ?? null,
    noindex: values.noindex ?? false,
    series: values.series ?? null,
    seriesPart: values.seriesPart ?? null,
    authorId: values.authorId,
    coverFocus: null,
  };
}
