// Foxing's side of Carrel's site API (site-api owns the route, key, rate limit and body shapes). Every write goes through
// adminRepo's Journal functions (journalInput schema), audited in admin_audit_log with Carrel's changeId; nothing here
// writes journal_posts by a path of its own.
// A post credits one staff author (author_id), resolved from the file's display name on every save; a name that is no
// one's is refused, and a post with none credits Foxing. A write with the Carrel key has no session, so versions are
// credited to the post's author.
// Scheduling: one row per post in site-api's scheduled_updates. On a draft it makes the post "scheduled"; on a live post
// it is a waiting update that replaces the live text at publish_at. Every state-changing write drops the row (a save of a
// live post keeps it, a rename moves it); the per-minute cron's runSchedules applies due rows. A version is updated_at in
// ms plus, while a schedule waits, a hash of its time and change id.
// A rename moves the slug (the id and address) and leaves a 301 (journal_slug_redirects) for a post ever published.

import { RENDER_VERSION } from "@drdustinedwards/site-helpers/render/nomath";
import {
  ContentId,
  ContentTag,
  contentVersion,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type ContentDoc,
  type ContentStatus,
  type ContentSummary,
  type DueSchedule,
  type ListQuery,
  type Revision,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { SEARCH_FIELDS } from "@dustinedwards/site-api/frontmatter";
import { d1ScheduledUpdates, utc, waitingUpdates } from "@dustinedwards/site-api/schedules";
import { adminEmails } from "@dustinedwards/site-runtime/access";
import { notFoundReport } from "@dustinedwards/site-runtime/not-found";
import { adminRepo, type catalogRepo, createDb, type Db, isUniqueViolation } from "@foxing/core";
import type { JournalPreview } from "../../context";
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

const FOXING_ORIGIN = SITE_ORIGIN;

const CARREL_ACTOR = "carrel";

const FOXING = "Foxing";

const KIND = "journal";

const UNSAVED_PREVIEW_SLUG = "carrel-preview";

/** Addresses under /journal/ that a route answers before any post, so no post may take one. */
const RESERVED_SLUGS = new Set(["archive", "tag"]);

/** An earlier version's id, from journal_post_versions: distinct from a current version's digits. */
const REVISION_PREFIX = "r-";

const EVENT_MESSAGE: Record<string, string> = {
  save: "The post before a save.",
  publish: "The post before it was published.",
  unpublish: "The post before it was taken off the Journal.",
  rename: "The post before it was renamed, at its old address.",
};

function blankPost(slug: string): JournalPost {
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

type Pending = { publishAt: string; changeId: string } | null;

/** A post's version: its updated_at in milliseconds, which every Journal write moves forward, and its schedule's. */
async function versionOf(row: { updatedAt: Date }, pending: Pending): Promise<string> {
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

function fieldsOf(row: JournalPost, author: string): JournalFields {
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

function readSource(source: string): JournalFields {
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

async function summaryOf(
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

function listFilter(
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

function notTrashed(row: { trashedAt: Date | null }) {
  if (row.trashedAt) throw new RefusedError("This post is in the trash. Restore it first.");
}

export function journalSiteAdapter(options: {
  env: Env;
  sourceIp: string | null;
  renderPreview?: (slug: string, post: JournalPreview) => Promise<Response>;
}): SiteAdapter {
  const { env, sourceIp, renderPreview } = options;
  const db: Db = createDb(env.DB);
  const schedules = d1ScheduledUpdates(env.DB);

  const namesOf = (ids: ReadonlyArray<string | null>) => adminRepo.journalPeopleNames(db, ids);

  const creditOf = (names: Map<string, string>, authorId: string | null) =>
    (authorId && names.get(authorId)) || FOXING;

  async function fileOf(row: JournalPost): Promise<JournalFields> {
    return fieldsOf(row, creditOf(await namesOf([row.authorId]), row.authorId));
  }

  /** The staff account a file's authors name, or null for Foxing alone; `current` keeps a post's author after they leave staff. */
  async function authorIdFor(authors: string[], current: string | null): Promise<string | null> {
    const named = authors.filter((a) => a.toLowerCase() !== FOXING.toLowerCase());
    if (named.length === 0) return null;
    if (named.length > 1)
      throw new RefusedError("A Journal post credits one author: name one, or Foxing.");
    const wanted = named[0].toLowerCase();
    const staff = await adminRepo.listJournalStaff(db, adminEmails(env));
    if (current) staff.push({ id: current, name: (await namesOf([current])).get(current) ?? "" });
    const match = staff.find((s) => s.name.toLowerCase() === wanted);
    if (match) return match.id;
    const known = [FOXING, ...new Set(staff.map((s) => s.name).filter(Boolean))].join(", ");
    throw new RefusedError(
      `${named[0]} is not on Foxing's staff. A post credits one of: ${known}.`,
    );
  }

  async function rowValues(slug: string, fields: JournalFields, current: string | null) {
    return { ...validated(slug, fields), authorId: await authorIdFor(fields.authors, current) };
  }

  async function pendingOf(slug: string): Promise<Pending> {
    const waiting = await schedules.get(slug);
    return waiting ? { publishAt: waiting.publishAt, changeId: waiting.changeId } : null;
  }

  const currentVersion = async (row: JournalPost) => versionOf(row, await pendingOf(row.slug));

  async function audit(action: string, params: Record<string, unknown>) {
    await adminRepo.writeAuditLog(db, {
      action,
      params: { ...params, via: "carrel" },
      actor: CARREL_ACTOR,
      sourceIp,
    });
  }

  async function conflict(slug: string): Promise<VersionConflictError> {
    const now = await adminRepo.getJournalBySlug(db, slug);
    return new VersionConflictError(now ? await currentVersion(now) : null);
  }

  async function expected(slug: string, version: string): Promise<JournalPost> {
    const row = await adminRepo.getJournalBySlug(db, slug);
    if (!row) throw new VersionConflictError(null);
    const current = await currentVersion(row);
    if (current !== version) throw new VersionConflictError(current);
    return row;
  }

  async function held(slug: string, version: string): Promise<JournalPost> {
    if (!(await adminRepo.getJournalBySlug(db, slug))) throw new NotFoundError();
    return expected(slug, version);
  }

  async function written(postId: string, changeId: string): Promise<WriteResult> {
    const row = await adminRepo.getJournalById(db, postId);
    if (!row) throw new Error(`journal post ${postId} was written and then could not be read`);
    const { version, status, scheduledUpdate } = await summaryOf(row, await pendingOf(row.slug));
    return { id: row.slug, version: version as string, status, changeId, scheduledUpdate };
  }

  async function save(row: JournalPost, source: string, changeId: string): Promise<Date> {
    const values = await rowValues(row.slug, readSource(source), row.authorId);
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
    // What goes live, or comes down, is this write, so a waiting schedule is dropped.
    await schedules.remove(slug).run();
    await audit(on ? "journal.publish" : "journal.unpublish", {
      id: row.id,
      slug,
      changeId: input.changeId,
      ...(on ? { firstPublish: !row.publishedAt } : {}),
      ...(publishedAt ? { publishedAt: input.publishedAt } : {}),
    });
    return written(row.id, input.changeId);
  }

  async function putSchedule(
    row: JournalPost,
    input: { source: string; publishAt: string; changeId: string },
  ) {
    const { source, publishAt, changeId } = input;
    await schedules.put(row.slug, { source, publishAt, changeId }).run();
    await audit("journal.schedule", {
      id: row.id,
      slug: row.slug,
      publishAt: utc(publishAt),
      changeId,
    });
    return written(row.id, changeId);
  }

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
    // A trashed post is off the Journal, so nothing it had waiting goes live.
    if (trashed) await schedules.remove(slug).run();
    await audit(trashed ? "journal.trash" : "journal.restore", {
      id: row.id,
      slug,
      changeId: input.changeId,
    });
    return written(row.id, input.changeId);
  }

  const content: SiteAdapter["content"] = {
    filters: ["kind", "tag", "author", "published"],
    postFields: ["excerpt", "authors", "series", "seriesPart"],
    searchFields: SEARCH_FIELDS,
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
      const none = { items: [], nextCursor: null, total: 0, sorted: { sort, dir } };
      if (query.kind !== undefined && query.kind !== KIND) return none;
      let authorId: string | null | undefined;
      if (query.author !== undefined && query.author.toLowerCase() !== FOXING.toLowerCase()) {
        const wanted = query.author.toLowerCase();
        const person = (await adminRepo.listJournalStaff(db, adminEmails(env))).find(
          (s) => s.name.toLowerCase() === wanted,
        );
        if (!person) return none;
        authorId = person.id;
      } else if (query.author !== undefined) authorId = null;
      const waiting = await waitingUpdates(env.DB);
      const filter = listFilter(query, [...waiting.keys()], authorId);
      const [rows, total] = await Promise.all([
        adminRepo.listJournalAdmin(db, { ...filter, sort, dir, limit: query.limit + 1, offset }),
        adminRepo.countJournalAdmin(db, filter),
      ]);
      const page = rows.slice(0, query.limit);
      const names = await namesOf(page.map((row) => row.authorId));
      return {
        // A slug the contract's id grammar cannot carry is left out rather than failing the page.
        items: await Promise.all(
          page
            .filter((row) => ContentId.safeParse(row.slug).success)
            .map((row) =>
              summaryOf(row, waiting.get(row.slug) ?? null, creditOf(names, row.authorId)),
            ),
        ),
        nextCursor: rows.length > query.limit ? String(offset + query.limit) : null,
        total,
        sorted: { sort, dir },
      };
    },

    async get(id): Promise<ContentDoc | null> {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row) return null;
      const fields = await fileOf(row);
      const summary = await summaryOf(row, await pendingOf(id), fields.authors[0]);
      return {
        ...summary,
        format: "markdown",
        source: journalToSource(fields),
        version: summary.version as string,
      };
    },

    // Keeps the stored status: a save to a live post edits it live (its waiting update stays), a scheduled draft goes back
    // to draft, a new post starts as a draft.
    async saveDraft(id, input) {
      if (input.expectedVersion !== null) {
        const row = await expected(id, input.expectedVersion);
        notTrashed(row);
        await save(row, input.source, input.changeId);
        if (!row.isPublished) await schedules.remove(id).run();
        return written(row.id, input.changeId);
      }
      const existing = await adminRepo.getJournalBySlug(db, id);
      if (existing) throw new VersionConflictError(await currentVersion(existing));
      const { authorId, ...values } = await rowValues(id, readSource(input.source), null);
      let postId: string;
      try {
        postId = await adminRepo.createJournalPost(
          db,
          { ...values, slug: id, isPublished: false },
          authorId,
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw await conflict(id);
        throw error;
      }
      await audit("journal.create", { id: postId, slug: id, changeId: input.changeId });
      return written(postId, input.changeId);
    },

    // A first publish from the Carrel key is allowed; setJournalPublished stamps published_at the first time.
    async publish(id, input) {
      return setPublished(id, true, input);
    },

    async schedule(id, input) {
      const row = await expected(id, input.expectedVersion);
      notTrashed(row);
      const source = input.source ?? journalToSource(await fileOf(row));
      await rowValues(id, readSource(source), row.authorId);
      if (input.source !== undefined) await save(row, input.source, input.changeId);
      return putSchedule(row, { ...input, source });
    },

    async unpublish(id, input) {
      return setPublished(id, false, input);
    },

    async setTags(id, input) {
      const row = await held(id, input.expectedVersion);
      notTrashed(row);
      await save(
        row,
        journalToSource({ ...(await fileOf(row)), tags: input.tags }),
        input.changeId,
      );
      return written(row.id, input.changeId);
    },

    async trash(id, input) {
      return setTrashed(id, true, input);
    },

    async restore(id, input) {
      return setTrashed(id, false, input);
    },

    // Only from the trash, so a live post never loses its address in one step.
    async delete(id, input) {
      const row = await held(id, input.expectedVersion);
      if (!row.trashedAt)
        throw new RefusedError("Move the post to the trash first: a delete cannot be undone.");
      if (!(await adminRepo.deleteJournalPost(db, row.id, { expectedUpdatedAt: row.updatedAt })))
        throw await conflict(id);
      await schedules.remove(id).run();
      await audit("journal.delete", { id: row.id, slug: id, changeId: input.changeId });
    },

    // The slug is the post's id and address, so both move and a preview link naming the old id stops working.
    async rename(id, input) {
      const row = await held(id, input.expectedVersion);
      const { newId } = input;
      validated(newId, await fileOf(row));
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
        if (isUniqueViolation(error)) throw new RefusedError(`${newId} is already taken.`);
        throw error;
      }
      if (!done) throw await conflict(id);
      const waiting = await schedules.get(id);
      if (waiting) {
        await schedules
          .put(newId, {
            source: waiting.source,
            publishAt: waiting.publishAt,
            changeId: waiting.changeId,
          })
          .run();
        await schedules.remove(id).run();
      }
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
      const names = await namesOf([
        row.authorId,
        ...earlier.flatMap((v) => [v.savedBy, v.authorId]),
      ]);
      const current = creditOf(names, row.authorId);
      const items: Revision[] = [
        {
          version: await currentVersion(row),
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
      return items;
    },

    async revisionSource(id, version) {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row) return null;
      if (version === (await currentVersion(row))) return journalToSource(await fileOf(row));
      if (!version.startsWith(REVISION_PREFIX)) return null;
      const earlier = await adminRepo.getJournalVersion(
        db,
        row.id,
        version.slice(REVISION_PREFIX.length),
      );
      if (!earlier) return null;
      const text = { title: earlier.title, excerpt: earlier.excerpt, content: earlier.content };
      if (!earlier.fields)
        return journalToSource({ ...(await fileOf(row)), ...text }, HISTORY_KEYS);
      const { slug: _slug, ...kept } = earlier.fields;
      const author = creditOf(await namesOf([earlier.authorId]), earlier.authorId);
      // A version kept before the search fields has none; those stay as the post has them now.
      return journalToSource({ ...(await fileOf(row)), ...kept, ...text, authors: [author] });
    },
  };

  // Drawn by the journal route from the file in hand, not the stored row: nothing is written or cached; marked noindex.
  async function render(input: { id?: string; source: string }): Promise<string> {
    if (!renderPreview) throw new Error("this site API was built without a preview renderer");
    const slug = input.id ?? UNSAVED_PREVIEW_SLUG;
    const stored = input.id ? await adminRepo.getJournalBySlug(db, input.id) : null;
    // A bare body with no front matter still previews as an untitled post; a save refuses it.
    const fields: JournalFields = input.source.startsWith("---")
      ? readSource(input.source)
      : {
          ...fieldsOf({ ...blankPost(slug), title: "Untitled" }, FOXING),
          content: input.source,
        };
    const values = await rowValues(slug, fields, stored?.authorId ?? null);
    const post: JournalPreview = {
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
    const page = await renderPreview(slug, post);
    if (!page.ok) throw new Error(`the journal route answered a preview with ${page.status}`);
    return page.text();
  }

  const scheduled: NonNullable<SiteAdapter["schedules"]> = {
    async get(id) {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row?.isPublished) return null;
      return schedules.get(id);
    },

    async update(id, input) {
      const row = await expected(id, input.expectedVersion);
      if (!row.isPublished) throw new RefusedError("Only a live post takes a scheduled update.");
      await rowValues(id, readSource(input.source), row.authorId);
      return putSchedule(row, input);
    },

    async cancel(id, input) {
      const row = await held(id, input.expectedVersion);
      if (!(await schedules.get(id))) throw new RefusedError("Nothing is scheduled for this post.");
      await schedules.remove(id).run();
      await audit("journal.unschedule", { id: row.id, slug: id, changeId: input.changeId });
      return written(row.id, input.changeId);
    },

    async due({ now, limit }) {
      const due = await schedules.due(now, limit);
      return Promise.all(
        due.map(async (d): Promise<DueSchedule> => {
          const row = await adminRepo.getJournalBySlug(db, d.id);
          return { ...d, kind: row?.isPublished ? "update" : "publish" };
        }),
      );
    },

    // The post's write comes first, the row second (matched on its time and change id, so a reschedule in between
    // survives); if the drop fails the next pass finds the post already as the row describes.
    async apply(id, input) {
      const row = await adminRepo.getJournalBySlug(db, id);
      const waiting = await schedules.get(id);
      if (!row || !waiting || row.trashedAt) return null;
      if (waiting.changeId !== input.changeId || waiting.publishAt !== utc(input.publishAt))
        return null;
      if (Date.parse(waiting.publishAt) > input.now.getTime()) return null;
      if (input.kind === "update") {
        if (!row.isPublished) return null;
        await save(row, waiting.source, input.changeId);
      } else {
        if (row.isPublished) return null;
        const done = await adminRepo.setJournalPublished(
          db,
          row.id,
          true,
          { expectedUpdatedAt: row.updatedAt },
          row.publishedAt ? {} : { publishedAt: new Date(waiting.publishAt) },
        );
        if (!done) return null;
        await audit("journal.publish", {
          id: row.id,
          slug: id,
          changeId: input.changeId,
          firstPublish: !row.publishedAt,
          scheduled: waiting.publishAt,
        });
      }
      await schedules
        .remove(id, { publishAt: waiting.publishAt, changeId: waiting.changeId })
        .run();
      return written(row.id, input.changeId);
    },
  };

  return {
    site: { id: "foxing", name: "Foxing", origin: FOXING_ORIGIN },
    content,
    schedules: scheduled,
    renderVersion: RENDER_VERSION,
    preview: { render },
    media: journalMediaAdapter({ env, audit }),
    insight: { notFound: (options) => notFoundReport(env.DB, options) },
  };
}
