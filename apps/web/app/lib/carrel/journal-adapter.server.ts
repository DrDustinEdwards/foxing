// Foxing's side of Carrel's site API (the site-api package): the package owns the route, the
// key, the rate limit and every body's shape; this adapter maps its content and preview calls onto
// the Journal's own code. Carrel is the Journal's only editor (Dustin, 2026-10-29: the admin
// Journal screens are gone). Every write goes through adminRepo's Journal functions, validated by
// its journalInput schema, and audited in admin_audit_log with Carrel's changeId. Nothing here
// writes journal_posts by a path of its own.
//
// Site-api v0.17.0: a trash (trashed_at), where trashing takes a live post off the Journal, a
// restore answers a draft, and only a trashed post is deleted for good (by Carrel, or by
// runSchedules 30 days on). A rename moves the post's slug, which is its id and its address, and
// a post that was ever published leaves a 301 at its old address (journal_slug_redirects). The
// list filters by kind, tag and publish date, searches the title and the body, sorts and counts.
// A publish may carry the date it goes out under. The body renders through Prelum on every read,
// so the render version meta names is the installed one. The Journal has no scheduled
// publishing: a schedule is refused, and there are no authors to credit or filter by (a post
// names none on its page).
//
// Media: the Journal's media library (journal-media-adapter.server.ts), so a post's cover and inline
// images can be uploaded from Carrel. A cover may still be any pasted https address, and book covers
// are not part of it.

import { RENDER_VERSION } from "@drdustinedwards/site-helpers/render/nomath";
import {
  ContentId,
  ContentTag,
  NotFoundError,
  previewDocument,
  RefusedError,
  VersionConflictError,
  type ContentDoc,
  type ContentStatus,
  type ContentSummary,
  type ListQuery,
  type Revision,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { notFoundReport } from "@dustinedwards/site-runtime/not-found";
import { adminRepo, type catalogRepo, createDb, type Db } from "@foxing/core";
import { renderJournalBody } from "../journal-body.server";
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

/** Foxing's public origin, which Carrel shows and links to. */
const FOXING_ORIGIN = SITE_ORIGIN;

/** The audit actor for every write made with the Carrel key. */
const CARREL_ACTOR = "carrel";

/** The one kind of content Carrel edits on Foxing. */
const KIND = "journal";

/** The slug a preview renders at when Carrel sends no id: a post not saved yet. */
const UNSAVED_PREVIEW_SLUG = "carrel-preview";

/** Addresses under /journal/ that a route answers before any post, so no post may take one. */
const RESERVED_SLUGS = new Set(["archive", "tag"]);

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

/** The Journal's own rules (adminRepo.journalInput), applied to every Carrel save. */
function validated(slug: string, fields: JournalFields) {
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

/** D1 reports a unique index violation in the error message; nothing else is matched. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function summaryOf(row: {
  slug: string;
  title: string;
  excerpt: string | null;
  tags: string[] | null;
  isPublished: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  trashedAt: Date | null;
}): ContentSummary {
  const status = statusOf(row);
  return {
    id: row.slug,
    kind: KIND,
    title: row.title,
    status,
    path: status === "published" ? `/journal/${row.slug}` : null,
    publishAt: null,
    publishedAt: status === "published" ? iso(row.publishedAt) : null,
    updatedAt: iso(row.updatedAt),
    version: versionOf(row),
    // Only tags the contract can carry, so one odd tag never fails the list.
    tags: (row.tags ?? []).filter((t) => ContentTag.safeParse(t).success),
    ...(row.excerpt ? { excerpt: row.excerpt } : {}),
    trashedAt: iso(row.trashedAt),
  };
}

/** The list's query, as adminRepo's Journal list takes it. */
function listFilter(query: ListQuery): adminRepo.JournalAdminQuery {
  return {
    published: query.status === undefined ? undefined : query.status === "published",
    q: query.q,
    tag: query.tag,
    publishedAfter: query.publishedAfter ? new Date(query.publishedAfter) : undefined,
    publishedBefore: query.publishedBefore ? new Date(query.publishedBefore) : undefined,
    trashed: query.trashed ?? false,
  };
}

function notTrashed(row: { trashedAt: Date | null }) {
  if (row.trashedAt) throw new RefusedError("This post is in the trash. Restore it first.");
}

export function journalSiteAdapter(options: {
  env: Env;
  /** The caller's address, for the audit log; null for the cron. */
  sourceIp: string | null;
  /** The root route's stylesheets, which a preview is drawn in; the cron passes none. */
  stylesheets?: string[];
}): SiteAdapter {
  const { env, sourceIp, stylesheets = [] } = options;
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

  /** As `expected`, for the v0.17.0 writes, which answer a missing id 404. */
  async function held(slug: string, version: string): Promise<JournalPost> {
    if (!(await adminRepo.getJournalBySlug(db, slug))) throw new NotFoundError();
    return expected(slug, version);
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
    input: { expectedVersion: string; changeId: string; source?: string; publishedAt?: string },
  ) {
    const row = await expected(slug, input.expectedVersion);
    if (on) notTrashed(row);
    const guard =
      input.source === undefined ? row.updatedAt : await save(row, input.source, input.changeId);
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : undefined;
    const done = await adminRepo.setJournalPublished(
      db,
      row.id,
      on,
      { expectedUpdatedAt: guard },
      { publishedAt },
    );
    if (!done) throw await conflict(slug);
    await audit(on ? "journal.publish" : "journal.unpublish", {
      id: row.id,
      slug,
      changeId: input.changeId,
      ...(on ? { firstPublish: !row.publishedAt } : {}),
      ...(publishedAt ? { publishedAt: input.publishedAt } : {}),
    });
    return written(row.id, input.changeId);
  }

  /** Into the trash or out of it, guarded on the version the caller saw. */
  async function setTrashed(
    slug: string,
    trashed: boolean,
    input: { expectedVersion: string; changeId: string },
  ) {
    const row = await held(slug, input.expectedVersion);
    if (Boolean(row.trashedAt) === trashed)
      throw new RefusedError(
        trashed ? "This post is in the trash already." : "This post is not in the trash.",
      );
    const done = await adminRepo.setJournalTrashed(db, row.id, trashed, {
      expectedUpdatedAt: row.updatedAt,
    });
    if (!done) throw await conflict(slug);
    await audit(trashed ? "journal.trash" : "journal.restore", {
      id: row.id,
      slug,
      changeId: input.changeId,
    });
    return written(row.id, input.changeId);
  }

  const content: SiteAdapter["content"] = {
    filters: ["kind", "tag", "published"],
    postFields: ["excerpt"],
    publishedAtSettable: true,

    async list(query) {
      let offset = 0;
      if (query.cursor !== undefined) {
        if (!/^\d{1,9}$/.test(query.cursor))
          throw new RefusedError("The cursor is not one this site gave.");
        offset = Number(query.cursor);
      }
      const sort = query.sort ?? "updated";
      const dir = query.dir ?? (sort === "title" ? "asc" : "desc");
      // The Journal has no scheduled publishing, so nothing is ever scheduled, and every post is
      // a journal post.
      if (query.status === "scheduled" || (query.kind !== undefined && query.kind !== KIND))
        return { items: [], nextCursor: null, total: 0, sorted: { sort, dir } };
      const filter = listFilter(query);
      const [rows, total] = await Promise.all([
        adminRepo.listJournalAdmin(db, { ...filter, sort, dir, limit: query.limit + 1, offset }),
        adminRepo.countJournalAdmin(db, filter),
      ]);
      const page = rows.slice(0, query.limit);
      return {
        // A slug the contract's id grammar cannot carry is left out rather than failing the page.
        items: page.filter((row) => ContentId.safeParse(row.slug).success).map(summaryOf),
        nextCursor: rows.length > query.limit ? String(offset + query.limit) : null,
        total,
        sorted: { sort, dir },
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
        notTrashed(row);
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

    // Unpublish returns the post to draft; a delete is from the trash.
    async unpublish(id, input) {
      return setPublished(id, false, input);
    },

    // The tags field of the post's file, written alone. A live post's page changes with it.
    async setTags(id, input) {
      const row = await held(id, input.expectedVersion);
      notTrashed(row);
      await save(row, journalToSource({ ...fieldsOf(row), tags: input.tags }), input.changeId);
      return written(row.id, input.changeId);
    },

    // A live post leaves the Journal as it goes in.
    async trash(id, input) {
      return setTrashed(id, true, input);
    },

    async restore(id, input) {
      return setTrashed(id, false, input);
    },

    // For good, with its history, and only from the trash, so a live post never loses its address
    // in one step.
    async delete(id, input) {
      const row = await held(id, input.expectedVersion);
      if (!row.trashedAt)
        throw new RefusedError("Move the post to the trash first: a delete cannot be undone.");
      if (!(await adminRepo.deleteJournalPost(db, row.id, { expectedUpdatedAt: row.updatedAt })))
        throw await conflict(id);
      await audit("journal.delete", { id: row.id, slug: id, changeId: input.changeId });
    },

    // The slug is the post's id and its address, so both move; its history is keyed by the row and
    // moves with it. A post ever published leaves a 301 at its old address. A preview link names
    // the old id, so it stops working, as the address it showed has.
    async rename(id, input) {
      const row = await held(id, input.expectedVersion);
      const { newId } = input;
      validated(newId, fieldsOf(row));
      if (await adminRepo.getJournalBySlug(db, newId))
        throw new RefusedError(`${newId} is already taken.`);
      const previousPath = row.publishedAt ? `/journal/${row.slug}` : null;
      let done: boolean;
      try {
        done = await adminRepo.renameJournalPost(
          db,
          row.id,
          newId,
          { redirect: previousPath !== null },
          { expectedUpdatedAt: row.updatedAt },
        );
      } catch (error) {
        // Taken by another write since the check above.
        if (isUniqueViolation(error)) throw new RefusedError(`${newId} is already taken.`);
        throw error;
      }
      if (!done) throw await conflict(id);
      await audit("journal.rename", {
        id: row.id,
        slug: newId,
        from: id,
        changeId: input.changeId,
      });
      return { ...(await written(row.id, input.changeId)), previousPath };
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

  // The post the save would publish: its body through the journal route's own Prelum render, in
  // the site's stylesheets and the route's markup, so nothing is written and nothing is cached. An
  // unsaved source has no row for the route to load, so the package's preview page carries it.
  async function render(input: { id?: string; source: string }): Promise<string> {
    const slug = input.id ?? UNSAVED_PREVIEW_SLUG;
    // A bare body with no front matter still previews, as an untitled post (site-api 0.17.0's
    // conformance asks it to); a save still refuses it.
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
    const html = await renderJournalBody(slug, values.content);
    const cover = values.coverImageUrl
      ? `<img src="${escapeHtml(values.coverImageUrl)}" alt="${escapeHtml(values.coverImageAlt ?? "")}" class="mb-10 fx-journal-post-img">`
      : "";
    return previewDocument({
      title: values.title,
      body: `<main class="fx-wrap"><article class="h-entry"><header class="mb-8"><p class="eyebrow">The Journal</p><h1 class="mt-3 fx-journal-post-title">${escapeHtml(values.title)}</h1></header>${cover}<div class="article-prose e-content">${html}</div></article></main>`,
      origin: FOXING_ORIGIN,
      stylesheets,
      attributes: { "data-theme": "light" },
    });
  }

  return {
    site: { id: "foxing", name: "Foxing", origin: FOXING_ORIGIN },
    content,
    renderVersion: RENDER_VERSION,
    preview: { render },
    media: journalMediaAdapter({ env, audit }),
    // The 404s workers/app.ts counts, for Carrel's report.
    insight: { notFound: (options) => notFoundReport(env.DB, options) },
  };
}
