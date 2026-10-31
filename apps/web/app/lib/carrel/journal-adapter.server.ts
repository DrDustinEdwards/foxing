// Foxing's side of Carrel's site API (the site-api package): the package owns the route, the
// key, the rate limit and every body's shape; this adapter maps its content and preview calls onto
// the Journal's own code. Every write goes through the adminRepo functions the admin Journal
// screens use (createJournalPost, updateJournalPost, setJournalPublished), validated by the same
// journalInput schema the admin routes parse with, and audited in admin_audit_log with Carrel's
// changeId. Nothing here writes journal_posts by a path of its own.
//
// Media: the Journal's media library (journal-media-adapter.server.ts), so a post's cover and inline
// images can be uploaded from Carrel. A cover may still be any pasted https address, and book covers
// are not part of it.

import {
  ContentId,
  RefusedError,
  VersionConflictError,
  type ContentDoc,
  type ContentStatus,
  type ContentSummary,
  type Revision,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { notFoundReport } from "@dustinedwards/site-runtime/not-found";
import { journalInput } from "@foxing/api";
import { adminRepo, type catalogRepo, createDb, type Db } from "@foxing/core";
import { RouterContextProvider } from "react-router";
import { cloudflareContext, journalPreviewContext } from "../../context";
import {
  HISTORY_KEYS,
  JournalSourceError,
  journalToSource,
  sourceToJournal,
  type JournalFields,
} from "./journal-source";
import { SITE_ORIGIN } from "../origins";
import { journalMediaAdapter } from "./journal-media-adapter.server";

type JournalPost = catalogRepo.JournalPost;

export type RenderDocument = (
  request: Request,
  context: RouterContextProvider,
) => Promise<Response>;

/** Foxing's public origin, which Carrel shows and links to. */
const FOXING_ORIGIN = SITE_ORIGIN;

/** The audit actor for every write made with the Carrel key. */
const CARREL_ACTOR = "carrel";

/** The slug a preview renders at when Carrel sends no id: a post not saved yet. */
const UNSAVED_PREVIEW_SLUG = "carrel-preview";

/** An earlier version's id, from journal_post_versions: distinct from a current version's digits. */
const REVISION_PREFIX = "r-";

/** A post's version is its updated_at in milliseconds, which every Journal write moves forward. */
function versionOf(row: { updatedAt: Date }): string {
  return String(row.updatedAt.getTime());
}

function iso(at: Date | null | undefined): string | null {
  return at ? at.toISOString() : null;
}

function statusOf(row: { isPublished: boolean }): ContentStatus {
  return row.isPublished ? "published" : "draft";
}

function fieldsOf(row: JournalPost): JournalFields {
  return {
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    tags: row.tags ?? [],
    featured: row.featured,
    content: row.content,
  };
}

/** Carrel's file, read into the row's fields. A file that does not parse is the writer's to fix. */
function readSource(source: string): JournalFields {
  try {
    return sourceToJournal(source);
  } catch (error) {
    if (error instanceof JournalSourceError) throw new RefusedError(error.message);
    throw error;
  }
}

/** The file's key for each journalInput field, so a refusal names what the writer can see. */
const FILE_KEY: Record<string, string> = {
  coverImageUrl: "cover_image_url",
  coverImageAlt: "cover_image_alt",
  content: "the body",
  slug: "the id (slug)",
};

/** The admin routes' own rules, applied to a Carrel save: one set of rules for both. */
function validated(slug: string, fields: JournalFields) {
  const parsed = journalInput.safeParse({ slug, ...fields });
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

/** D1 reports a unique index violation in the error message; nothing else is matched. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function summaryOf(row: {
  slug: string;
  title: string;
  isPublished: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}): ContentSummary {
  const status = statusOf(row);
  return {
    id: row.slug,
    kind: "journal",
    title: row.title,
    status,
    path: status === "published" ? `/journal/${row.slug}` : null,
    publishAt: null,
    publishedAt: status === "published" ? iso(row.publishedAt) : null,
    updatedAt: iso(row.updatedAt),
  };
}

export function journalSiteAdapter(options: {
  env: Env;
  ctx: ExecutionContext;
  /** The origin the preview's page request is made against: the request's own. */
  origin: string;
  /** The caller's address, for the audit log. */
  sourceIp: string | null;
  /** The React Router request handler, for the preview. */
  renderDocument: RenderDocument | null;
}): SiteAdapter {
  const { env, ctx, origin, sourceIp, renderDocument } = options;
  const db: Db = createDb(env.DB);

  async function audit(action: string, params: Record<string, unknown>) {
    await adminRepo.writeAuditLog(db, {
      action,
      params: { ...params, via: "carrel" },
      actor: CARREL_ACTOR,
      sourceIp,
    });
  }

  /** The refusal for a write that lost a race: what the site holds now, or null when it is gone. */
  async function conflict(slug: string): Promise<VersionConflictError> {
    const now = await adminRepo.getJournalBySlug(db, slug);
    return new VersionConflictError(now ? versionOf(now) : null);
  }

  /** The stored row a versioned write names; a stale version, or a missing id, is a conflict. */
  async function expected(slug: string, version: string): Promise<JournalPost> {
    const row = await adminRepo.getJournalBySlug(db, slug);
    if (!row) throw new VersionConflictError(null);
    if (versionOf(row) !== version) throw new VersionConflictError(versionOf(row));
    return row;
  }

  async function written(postId: string, changeId: string): Promise<WriteResult> {
    const row = await adminRepo.getJournalById(db, postId);
    if (!row) throw new Error(`journal post ${postId} was written and then could not be read`);
    return { id: row.slug, version: versionOf(row), status: statusOf(row), changeId };
  }

  /** One guarded save of the file's fields through updateJournalPost. Returns the new updated_at. */
  async function save(row: JournalPost, source: string, changeId: string): Promise<Date> {
    const values = validated(row.slug, readSource(source));
    const saved = await adminRepo.updateJournalPost(db, row.id, values, null, {
      expectedUpdatedAt: row.updatedAt,
    });
    if (!saved) throw await conflict(row.slug);
    await audit("journal.update", { id: row.id, slug: row.slug, changeId });
    const after = await adminRepo.getJournalById(db, row.id);
    if (!after) throw new Error(`journal post ${row.id} was saved and then could not be read`);
    return after.updatedAt;
  }

  async function setPublished(
    slug: string,
    on: boolean,
    input: { expectedVersion: string; changeId: string; source?: string },
  ) {
    const row = await expected(slug, input.expectedVersion);
    const guard =
      input.source === undefined ? row.updatedAt : await save(row, input.source, input.changeId);
    const done = await adminRepo.setJournalPublished(db, row.id, on, { expectedUpdatedAt: guard });
    if (!done) throw await conflict(slug);
    await audit(on ? "journal.publish" : "journal.unpublish", {
      id: row.id,
      slug,
      changeId: input.changeId,
      ...(on ? { firstPublish: !row.publishedAt } : {}),
    });
    return written(row.id, input.changeId);
  }

  const content: SiteAdapter["content"] = {
    async list(query) {
      let offset = 0;
      if (query.cursor !== undefined) {
        if (!/^\d{1,9}$/.test(query.cursor))
          throw new RefusedError("The cursor is not one this site gave.");
        offset = Number(query.cursor);
      }
      // The Journal has no scheduled publishing, so nothing is ever scheduled.
      if (query.status === "scheduled") return { items: [], nextCursor: null };
      const rows = await adminRepo.listJournalAdmin(db, {
        limit: query.limit + 1,
        offset,
        published: query.status === undefined ? undefined : query.status === "published",
        q: query.q,
      });
      const page = rows.slice(0, query.limit);
      return {
        // A slug the contract's id grammar cannot carry is left out rather than failing the page.
        items: page.filter((row) => ContentId.safeParse(row.slug).success).map(summaryOf),
        nextCursor: rows.length > query.limit ? String(offset + query.limit) : null,
      };
    },

    async get(id): Promise<ContentDoc | null> {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row) return null;
      return {
        ...summaryOf(row),
        format: "markdown",
        source: journalToSource(fieldsOf(row)),
        version: versionOf(row),
      };
    },

    // Keeps the stored status, as the contract's reference adapter does: a save to a live post
    // edits it live, and a new post starts as a draft.
    async saveDraft(id, input) {
      if (input.expectedVersion !== null) {
        const row = await expected(id, input.expectedVersion);
        await save(row, input.source, input.changeId);
        return written(row.id, input.changeId);
      }
      const existing = await adminRepo.getJournalBySlug(db, id);
      if (existing) throw new VersionConflictError(versionOf(existing));
      const values = validated(id, readSource(input.source));
      let postId: string;
      try {
        postId = await adminRepo.createJournalPost(
          db,
          { ...values, slug: id, isPublished: false },
          null,
        );
      } catch (error) {
        // Created by another write since the check above: the id is no longer free.
        if (isUniqueViolation(error)) throw await conflict(id);
        throw error;
      }
      await audit("journal.create", { id: postId, slug: id, changeId: input.changeId });
      return written(postId, input.changeId);
    },

    // A first publish from the Carrel key is allowed (Carrel design decision 2). It goes through
    // setJournalPublished, which stamps published_at the first time, as the admin publish does.
    async publish(id, input) {
      return setPublished(id, true, input);
    },

    async schedule(id, input) {
      await expected(id, input.expectedVersion);
      throw new RefusedError(
        "The Journal has no scheduled publishing. Publish it now, or keep it a draft.",
      );
    },

    // Unpublish returns the post to draft; deleting stays with the admin screens.
    async unpublish(id, input) {
      return setPublished(id, false, input);
    },

    async revisions(id) {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row) return null;
      const earlier = await adminRepo.listJournalVersions(db, row.id);
      const items: Revision[] = [
        {
          version: versionOf(row),
          at: row.updatedAt.toISOString(),
          author: "current",
          message: "The post as it stands now.",
        },
        ...earlier.map((v) => ({
          version: `${REVISION_PREFIX}${v.id}`,
          at: v.savedAt.toISOString(),
          author: (v.savedBy ?? "not recorded").slice(0, 200),
          message:
            `The text before a save by ${v.savedBy ?? "the Carrel key or a removed account"}. ` +
            "History keeps the title, excerpt and body, not the cover, tags or featured flag.",
        })),
      ];
      return items;
    },

    async revisionSource(id, version) {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row) return null;
      if (version === versionOf(row)) return journalToSource(fieldsOf(row));
      if (!version.startsWith(REVISION_PREFIX)) return null;
      const earlier = await adminRepo.getJournalVersion(
        db,
        row.id,
        version.slice(REVISION_PREFIX.length),
      );
      if (!earlier) return null;
      return journalToSource(
        {
          ...fieldsOf(row),
          title: earlier.title,
          excerpt: earlier.excerpt,
          content: earlier.content,
        },
        HISTORY_KEYS,
      );
    },
  };

  // The page the save would publish, rendered through the journal route and the root layout
  // in-process, so nothing is written and nothing is cached.
  async function render(input: { id?: string; source: string }): Promise<string> {
    if (!renderDocument)
      throw new Error("the React Router handler was not passed to the Carrel adapter");
    const slug = input.id ?? UNSAVED_PREVIEW_SLUG;
    // A bare body with no front matter still previews, as an untitled post (site-api 0.17.0's conformance
    // asks it to); a save still refuses it.
    const fields = input.source.startsWith("---")
      ? readSource(input.source)
      : {
          title: "Untitled",
          excerpt: null,
          coverImageUrl: null,
          coverImageAlt: null,
          tags: [],
          featured: false,
          content: input.source,
        };
    const values = validated(slug, fields);
    const stored = input.id ? await adminRepo.getJournalBySlug(db, input.id) : null;
    const now = new Date();
    const post: JournalPost = {
      id: stored?.id ?? UNSAVED_PREVIEW_SLUG,
      authorId: stored?.authorId ?? null,
      relatedPostIds: stored?.relatedPostIds ?? null,
      isPublished: true,
      publishedAt: stored?.publishedAt ?? now,
      showPublishedAt: stored?.showPublishedAt ?? true,
      showUpdatedAt: stored?.showUpdatedAt ?? true,
      ogTitle: stored?.ogTitle ?? null,
      ogDescription: stored?.ogDescription ?? null,
      canonicalUrl: stored?.canonicalUrl ?? null,
      readingTimeMinutes: stored?.readingTimeMinutes ?? null,
      createdAt: stored?.createdAt ?? now,
      updatedAt: now,
      slug,
      title: values.title,
      content: values.content,
      excerpt: values.excerpt ?? null,
      coverImageUrl: values.coverImageUrl ?? null,
      coverImageAlt: values.coverImageAlt ?? null,
      tags: values.tags ?? [],
      featured: values.featured ?? false,
    };

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    context.set(journalPreviewContext, post);
    const response = await renderDocument(
      new Request(`${origin}/journal/${slug}`, { headers: { accept: "text/html" } }),
      context,
    );
    if (!response.ok) {
      throw new RefusedError(
        `The page did not render: the journal route answered ${response.status}.`,
      );
    }
    return response.text();
  }

  return {
    site: { id: "foxing", name: "Foxing", origin: FOXING_ORIGIN },
    content,
    preview: { render },
    media: journalMediaAdapter({ env, audit }),
    // The 404s workers/app.ts counts, for Carrel's report.
    insight: { notFound: (options) => notFoundReport(env.DB, options) },
  };
}
