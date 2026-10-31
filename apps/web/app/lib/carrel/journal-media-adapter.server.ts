// The Journal's media library, as site-api's media group for Carrel: uploads for a Journal post's
// cover and inline images. Editorial only: it is reached with the Carrel key alone, and nothing a
// reader can call uploads an image (posts by readers carry none, Capsid foxing/do-not-build.md).
// Book covers are not in it: books.cover_url and its covers.foxing.app files are left as they are,
// and a Journal cover may still be any pasted https address.
//
// Storage: the bytes in the MEDIA R2 bucket under journal/ (never a reader/ key), served by the
// Worker at /media/<key>; the index in D1 (journal_media, @foxing/core's journalMediaRepo); every
// earlier set of bytes, and a deleted file's last ones, copied to the private BACKUPS bucket under
// journal-media/ first, and never deleted from there. Every write lands on the version it names in
// one statement (writeJournalMediaAtRev), so a stale write is a 409, never a lost update.
//
// Offered from site-api v0.13: list and search, upload, alt, tags, trash and restore, delete by the
// Journal's own reference check, caption, replace, duplicates, usage, lenses and filters, import,
// credit and license, turns and mirrors, history and revert, the change log, shrinking at upload
// and the resize pass, embedded metadata and suggestions. An upload, a replace and the resize pass
// go through site-api's prepareUpload (v0.15): HEIC and HEIF to JPEG, the location taken out, the
// shrink, the size, the embedded metadata, and the placeholder and color the library shows. Not
// offered: the focal point, since no Journal page crops around one (their covers are cropped by
// CSS, object-fit: cover), so a point set in Carrel would change nothing a reader sees.

import { slugify } from "@drdustinedwards/site-helpers/slug";
import {
  type MediaAdapter,
  MediaInUseError,
  type MediaItem,
  type MediaResize,
  type MediaRevision,
  type MediaTransformOp,
  NotFoundError,
  placeholderAndColor,
  prepareUpload,
  RefusedError,
  sha256Hex,
  turnsSize,
  VersionConflictError,
} from "@dustinedwards/site-api";
import { type R2BucketLike, replaceObject } from "@dustinedwards/site-api/r2";
import { editImage } from "@dustinedwards/site-runtime/image";
import { createDb, type Db, journalMediaRepo } from "@foxing/core";
import { SITE_ORIGIN } from "../origins";
import { suggestFor } from "./media-suggest.server";

type Row = journalMediaRepo.JournalMediaRow;
type Write = journalMediaRepo.JournalMediaWrite;

/** The stored types, each re-encodable by the Images binding but GIF, which may be animated. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
type Encoded = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
const REENCODED = new Set<string>(["image/jpeg", "image/png", "image/webp", "image/avif"]);
/** Accepted too, and stored as JPEG by prepareUpload: an iPhone's photos. */
const CONVERTED = ["image/heic", "image/heif"];

/** Large enough for a camera file, which the upload then shrinks. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * What an upload shrinks to unless it says `resize=no`. Journal pages show a picture at most the
 * column's width, about 1,200 CSS pixels, so 2,560 keeps it sharp on a 2x screen. The original is
 * kept in BACKUPS and in the file's history.
 */
const RESIZE: MediaResize = { maxEdge: 2560, quality: 85 };

/** A turn or a mirror re-encodes a lossy picture, so it keeps a high quality. */
const TRANSFORM_QUALITY = 92;

const TRANSFORMS: Record<MediaTransformOp, { rotate?: 90 | 180 | 270; flip?: "h" | "v" }> = {
  "rotate-90": { rotate: 90 },
  "rotate-180": { rotate: 180 },
  "rotate-270": { rotate: 270 },
  "flip-h": { flip: "h" },
  "flip-v": { flip: "v" },
};

/** Where BACKUPS keeps the Journal's earlier bytes: apart from the D1 dumps under backups/json/. */
const BACKUP_PREFIX = "journal-media";

/** A file's version is its row's rev, which every write moves in the statement that checks it. */
const versionOf = (rev: number) => `r${rev}`;

/** The rev a version names, or -1 (which no row holds) for anything this site never answered. */
function revOf(version: string): number {
  return /^r(0|[1-9]\d{0,15})$/.test(version) ? Number(version.slice(1)) : -1;
}

/** The address a page uses: absolute, as the Journal's cover_image_url must be. */
function journalMediaUrl(key: string): string {
  return `${SITE_ORIGIN}${journalMediaRepo.JOURNAL_MEDIA_PATH}${key}`;
}

function itemOf(row: Row, usedCount?: number): MediaItem {
  const url = journalMediaUrl(row.key);
  return {
    id: row.key,
    url,
    filename: row.filename ? row.filename.slice(0, 300) : null,
    contentType: row.contentType,
    bytes: row.bytes,
    width: row.width && row.width > 0 ? row.width : null,
    height: row.height && row.height > 0 ? row.height : null,
    alt: row.alt,
    uploadedAt: row.uploadedAt.toISOString(),
    deletable: true,
    version: versionOf(row.rev),
    tags: row.tags,
    trashedAt: row.trashedAt ? row.trashedAt.toISOString() : null,
    caption: row.caption,
    ...(usedCount === undefined ? {} : { usedCount }),
    placeholder: row.placeholder,
    color: row.color,
    credit: row.credit,
    license: row.license,
    sourceUrl: row.sourceUrl,
    licenseExpires: row.licenseExpires,
    takenAt: row.takenAt,
    downloadUrl: url,
  };
}

/** A versioned write's outcome as the contract's answer, or its error. */
function answer(write: Write): { version: string } {
  if (write.ok) return { version: versionOf(write.rev) };
  if (write.reason === "missing") throw new NotFoundError("No such media.");
  throw new VersionConflictError(versionOf(write.rev), "The file changed since it was loaded.");
}

/** A new key: journal/<year>/<month>/<the name as a slug>-<8 random hex>.<ext>, a valid media id. */
function newKey(filename: string, contentType: string): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const name = slugify(filename.replace(/\.[A-Za-z0-9]{1,5}$/, ""), { max: 60 }) || "image";
  const random = [...crypto.getRandomValues(new Uint8Array(4))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `journal/${now.getUTCFullYear()}/${month}/${name}-${random}.${EXTENSIONS[contentType]}`;
}

/** What each use's detail says: the post's cover, its body, or both. */
function detailOf(use: { inCover: number | boolean; inBody: number | boolean }): string {
  if (use.inCover && use.inBody) return "cover image and body";
  return use.inCover ? "cover image" : "body";
}

export function journalMediaAdapter(options: {
  env: Env;
  /** Records one write in admin_audit_log with Carrel's changeId. */
  audit: (action: string, params: Record<string, unknown>) => Promise<void>;
}): MediaAdapter {
  const { env, audit } = options;
  const db: Db = createDb(env.DB);
  // The binding's `put` takes a wider `onlyIf` than the helper's narrow interface names; the shapes it uses agree.
  const bucket = env.MEDIA as unknown as R2BucketLike;

  async function row(id: string): Promise<Row> {
    const found = await journalMediaRepo.getJournalMedia(db, id);
    if (!found) throw new NotFoundError("No such media.");
    return found;
  }

  /** The row at the version the caller loaded, or the conflict that says what the site holds. */
  async function rowAt(id: string, expectedVersion: string): Promise<Row> {
    const found = await row(id);
    if (found.rev !== revOf(expectedVersion)) {
      throw new VersionConflictError(versionOf(found.rev), "The file changed since it was loaded.");
    }
    return found;
  }

  /** A metadata write at the caller's version, audited under its change id. */
  async function writeAt(
    id: string,
    fields: journalMediaRepo.JournalMediaFields,
    input: { expectedVersion: string; changeId: string },
    action: string,
  ) {
    const written = answer(
      await journalMediaRepo.writeJournalMediaAtRev(db, id, fields, revOf(input.expectedVersion)),
    );
    await audit(action, { key: id, changeId: input.changeId });
    return written;
  }

  /** The revision a file with no recorded history has: its upload, which is its current bytes. */
  function firstOf(file: Row) {
    return {
      mediaKey: file.key,
      at: file.uploadedAt,
      bytes: file.bytes,
      width: file.width,
      height: file.height,
      reason: file.sourceUrl ? "import" : "upload",
      sha256: file.sha256,
    };
  }

  /**
   * Puts new bytes under a file's key as its newest revision, its current ones copied to BACKUPS
   * first: the one way a stored file's bytes change (replace, transform, resize, revert). The caller
   * has claimed the version, so a stale writer never gets here. A placeholder and color not given
   * (a turn, a revert) are made again from the new bytes.
   */
  async function swapBytes(
    file: Row,
    next: {
      bytes: Uint8Array;
      width: number | null;
      height: number | null;
      reason: string;
      placeholder?: string | null;
      color?: string | null;
    },
  ): Promise<MediaItem> {
    const current = await env.MEDIA.get(file.key);
    if (!current) throw new NotFoundError("No such media.");
    const backupKey = `${BACKUP_PREFIX}/replaced/${new Date().toISOString()}/${file.key}`;
    await env.BACKUPS.put(backupKey, current.body, {
      httpMetadata: current.httpMetadata,
      customMetadata: current.customMetadata,
    });
    const [latest] = await journalMediaRepo.listJournalMediaRevisions(db, file.key, 1);
    const kept = latest?.id ?? (await journalMediaRepo.addJournalMediaRevision(db, firstOf(file)));
    await journalMediaRepo.keepJournalMediaRevision(db, kept, backupKey);

    await replaceObject(bucket, file.key, { bytes: next.bytes, contentType: file.contentType });
    const sha256 = await sha256Hex(next.bytes);
    await journalMediaRepo.addJournalMediaRevision(db, {
      mediaKey: file.key,
      at: new Date(),
      bytes: next.bytes.byteLength,
      width: next.width,
      height: next.height,
      reason: next.reason,
      sha256,
    });
    const look =
      next.placeholder !== undefined
        ? { placeholder: next.placeholder, color: next.color ?? null }
        : await placeholderAndColor(env.IMAGES, next.bytes);
    await journalMediaRepo.writeJournalMediaAtRev(db, file.key, {
      bytes: next.bytes.byteLength,
      width: next.width,
      height: next.height,
      sha256,
      ...look,
    });
    return itemOf(await row(file.key));
  }

  /** Claims the version before an R2 write: the rev moves first, so a stale writer changes nothing. */
  async function claim(id: string, expectedVersion: string): Promise<void> {
    answer(await journalMediaRepo.writeJournalMediaAtRev(db, id, {}, revOf(expectedVersion)));
  }

  return {
    limits: { maxBytes: MAX_BYTES, types: [...Object.keys(EXTENSIONS), ...CONVERTED] },
    lenses: ["unattached", "no-alt", "large", "duplicates", "license-expired", "oversized"],
    // No Journal page is sized by a file's address, so a replace may change a picture's size, and
    // a quarter turn turns in place.
    replaceKeepsSize: false,
    usage: true,
    filters: true,
    resize: RESIZE,
    readsEmbedded: true,
    // The package checks every address and each redirect before this fetch runs.
    importFetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, init)) as typeof fetch,

    async list(query) {
      let offset = 0;
      if (query.cursor !== undefined) {
        if (!/^\d{1,9}$/.test(query.cursor))
          throw new RefusedError("The cursor is not one this site gave.");
        offset = Number(query.cursor);
      }
      const trashed = query.trashed === "only";
      const sort = query.sort ?? "added";
      const dir = query.dir ?? (sort === "name" ? "asc" : "desc");
      const filter = {
        q: query.q,
        tag: query.tag,
        trashed,
        lens: query.lens,
        orientation: query.orientation,
        kind: query.kind,
        maxEdge: RESIZE.maxEdge,
      };
      // The cursor first: a change that lands while the page is read is in the next poll.
      const changeCursor = String(await journalMediaRepo.journalMediaChangeCursor(db));
      const [rows, total] = await Promise.all([
        journalMediaRepo.listJournalMedia(db, filter, {
          sort,
          dir,
          limit: query.limit + 1,
          offset,
        }),
        journalMediaRepo.countJournalMedia(db, filter),
      ]);
      return {
        items: rows.slice(0, query.limit).map((r) => itemOf(r, r.usedCount)),
        nextCursor: rows.length > query.limit ? String(offset + query.limit) : null,
        total,
        // The trash is always newest trashed first, so it claims no sort it did not apply.
        ...(trashed ? {} : { sorted: { sort, dir } }),
        changeCursor,
      };
    },

    async get(id) {
      const file = await journalMediaRepo.getJournalMedia(db, id);
      if (!file) return null;
      const uses = await journalMediaRepo.journalMediaUses(db, id);
      const twins = await journalMediaRepo.journalMediaTwins(db, id, file.sha256);
      return {
        ...itemOf(file, uses.length),
        usedBy: uses.map((use) => ({
          type: "journal",
          id: use.slug,
          title: use.title.slice(0, 1000),
          detail: detailOf(use),
        })),
        twins: twins.map((t) => ({
          id: t.key,
          filename: t.filename ? t.filename.slice(0, 300) : null,
        })),
      };
    },

    async upload(input) {
      // Converted from HEIC, its location taken out, shrunk, measured and its metadata read.
      const prepared = await prepareUpload(env.IMAGES, input, { resize: RESIZE });
      const { bytes, contentType, embedded: found, resizedFrom, original } = prepared;
      const key = newKey(prepared.filename, contentType);

      await env.MEDIA.put(key, bytes, {
        httpMetadata: { contentType },
        customMetadata: { originalName: prepared.filename },
      });
      const embedded = (["credit", "license", "caption", "takenAt"] as const).filter(
        (f) => found[f],
      );
      const uploadedAt = new Date();
      try {
        await journalMediaRepo.insertJournalMedia(db, {
          key,
          filename: prepared.filename,
          contentType,
          bytes: bytes.byteLength,
          width: prepared.width,
          height: prepared.height,
          sha256: prepared.sha256,
          placeholder: prepared.placeholder,
          color: prepared.color,
          alt: input.alt,
          credit: found.credit ?? "",
          license: found.license ?? "",
          caption: found.caption ?? "",
          takenAt: found.takenAt ?? null,
          sourceUrl: input.sourceUrl ?? null,
          uploadedAt,
        });
      } catch (error) {
        // No row, no file: the key is new, so nothing else can be using it.
        await env.MEDIA.delete(key);
        throw error;
      }

      if (resizedFrom && original) {
        // The original, as the revision the shrink replaced, in BACKUPS and in the file's history.
        const backupKey = `${BACKUP_PREFIX}/resized/${uploadedAt.toISOString()}/${key}`;
        await env.BACKUPS.put(backupKey, original, { httpMetadata: { contentType } });
        await journalMediaRepo.addJournalMediaRevision(db, {
          mediaKey: key,
          at: uploadedAt,
          bytes: original.byteLength,
          width: resizedFrom.width,
          height: resizedFrom.height,
          reason: input.sourceUrl ? "import" : "upload",
          sha256: await sha256Hex(original),
          backupKey,
        });
        const stored = await row(key);
        await journalMediaRepo.addJournalMediaRevision(db, {
          mediaKey: key,
          at: uploadedAt,
          bytes: stored.bytes,
          width: stored.width,
          height: stored.height,
          reason: "resize",
          sha256: stored.sha256,
        });
      }
      await audit(input.sourceUrl ? "journal-media.import" : "journal-media.upload", {
        key,
        changeId: input.changeId,
      });
      return {
        ...itemOf(await row(key), 0),
        ...(embedded.length > 0 ? { embedded: [...embedded] } : {}),
        ...(resizedFrom ? { resizedFrom } : {}),
      };
    },

    // The Journal's own reference check: a file a post's cover or body names is refused, naming
    // each post. The last bytes go to BACKUPS first, so a delete can be undone by hand.
    async delete(id, input) {
      const file = await row(id);
      const uses = await journalMediaRepo.journalMediaUses(db, id);
      if (uses.length > 0) {
        throw new MediaInUseError(
          uses.map((use) => ({
            type: "journal",
            id: use.slug,
            title: use.title.slice(0, 1000),
            detail: detailOf(use),
          })),
        );
      }
      const current = await env.MEDIA.get(file.key);
      if (current) {
        await env.BACKUPS.put(
          `${BACKUP_PREFIX}/deleted/${new Date().toISOString()}/${file.key}`,
          current.body,
          {
            httpMetadata: current.httpMetadata,
            customMetadata: current.customMetadata,
          },
        );
      }
      // One statement removes the row only if no post names the file now.
      if (!(await journalMediaRepo.deleteJournalMediaIfUnused(db, id))) {
        throw new RefusedError(
          `${id} came into use, or was removed, while this delete was being checked. Try again.`,
        );
      }
      await env.MEDIA.delete(file.key);
      await audit("journal-media.delete", { key: id, changeId: input.changeId });
    },

    // Alt is the file's default: saving it rewrites no post, whose own alt text stays as written.
    async setAlt(id, input) {
      return writeAt(id, { alt: input.alt }, input, "journal-media.alt");
    },

    async setTags(id, input) {
      return writeAt(id, { tags: input.tags }, input, "journal-media.tags");
    },

    // A trashed file keeps its object and its address, so a post that uses it is unchanged.
    async trash(id, input) {
      const file = await rowAt(id, input.expectedVersion);
      if (file.trashedAt) return { version: versionOf(file.rev) };
      return writeAt(id, { trashedAt: new Date() }, input, "journal-media.trash");
    },

    async restore(id, input) {
      const file = await rowAt(id, input.expectedVersion);
      if (!file.trashedAt) return { version: versionOf(file.rev) };
      return writeAt(id, { trashedAt: null }, input, "journal-media.restore");
    },

    async setCaption(id, input) {
      return writeAt(id, { caption: input.caption }, input, "journal-media.caption");
    },

    async setCredit(id, input) {
      const { credit, license, sourceUrl, licenseExpires } = input;
      return writeAt(
        id,
        { credit, license, sourceUrl, licenseExpires },
        input,
        "journal-media.credit",
      );
    },

    // Pages name a file with its bytes' hash (lib/journal-images.server.ts), and the size route keys
    // each size by the object's etag, so nothing is stale.
    async replace(id, input) {
      const prepared = await prepareUpload(env.IMAGES, { ...input, alt: "" });
      await claim(id, input.expectedVersion);
      const item = await swapBytes(await row(id), { ...prepared, reason: "replace" });
      await audit("journal-media.replace", { key: id, changeId: input.changeId });
      return { item, sizesNeedPurge: false };
    },

    async findByHash(sha256) {
      const file = await journalMediaRepo.journalMediaByHash(db, sha256);
      return file ? itemOf(file, file.usedCount) : null;
    },

    // In place, in the picture's own type: no Journal page is sized by the address.
    async transform(id, input) {
      const file = await rowAt(id, input.expectedVersion);
      if (!REENCODED.has(file.contentType)) {
        throw new RefusedError(
          `A ${file.contentType} picture is not turned here: a GIF may be animated, and a turn would keep one frame.`,
        );
      }
      const object = await env.MEDIA.get(id);
      if (!object) throw new NotFoundError("No such media.");
      const edited = await editImage(env.IMAGES, object.body, {
        ...TRANSFORMS[input.op],
        format: file.contentType as Encoded,
        quality: TRANSFORM_QUALITY,
      });
      const bytes = new Uint8Array(await edited.arrayBuffer());
      const swapped = turnsSize(input.op);
      await claim(id, input.expectedVersion);
      const item = await swapBytes(file, {
        bytes,
        width: swapped ? file.height : file.width,
        height: swapped ? file.width : file.height,
        reason: "transform",
      });
      await audit("journal-media.transform", { key: id, op: input.op, changeId: input.changeId });
      return { item, sizesNeedPurge: false };
    },

    async history(id) {
      const file = await journalMediaRepo.getJournalMedia(db, id);
      if (!file) return null;
      const recorded = await journalMediaRepo.listJournalMediaRevisions(db, id);
      const listed = recorded.length > 0 ? recorded : [{ id: 0, ...firstOf(file) }];
      return listed.map(
        (r, n): MediaRevision => ({
          rev: String(r.id),
          at: r.at.toISOString(),
          bytes: r.bytes,
          width: r.width && r.width > 0 ? r.width : null,
          height: r.height && r.height > 0 ? r.height : null,
          reason: r.reason as MediaRevision["reason"],
          current: n === 0,
        }),
      );
    },

    // Earlier bytes back under the same address, as a new revision, so a revert is undone by another.
    async revert(id, input) {
      const file = await row(id);
      const revision = (await journalMediaRepo.listJournalMediaRevisions(db, id)).find(
        (r) => String(r.id) === input.to,
      );
      const kept = revision?.backupKey ? await env.BACKUPS.get(revision.backupKey) : null;
      if (!revision || !kept)
        throw new NotFoundError("This file has no such earlier version, or its copy is gone.");
      const bytes = new Uint8Array(await kept.arrayBuffer());
      await claim(id, input.expectedVersion);
      const item = await swapBytes(file, {
        bytes,
        width: revision.width,
        height: revision.height,
        reason: "revert",
      });
      await audit("journal-media.revert", { key: id, to: input.to, changeId: input.changeId });
      return { item, sizesNeedPurge: false };
    },

    async shrink(id, input) {
      const file = await rowAt(id, input.expectedVersion);
      const object = await env.MEDIA.get(id);
      if (!object) throw new NotFoundError("No such media.");
      const small = await prepareUpload(
        env.IMAGES,
        {
          bytes: new Uint8Array(await object.arrayBuffer()),
          contentType: file.contentType,
          filename: file.filename ?? id,
          alt: "",
          changeId: input.changeId,
          resize: true,
        },
        { resize: RESIZE },
      );
      if (!small.resizedFrom) return { resized: false, item: itemOf(file) };
      await claim(id, input.expectedVersion);
      const item = await swapBytes(file, { ...small, reason: "resize" });
      await audit("journal-media.resize", { key: id, changeId: input.changeId });
      return { resized: true, item };
    },

    // From the change log the triggers on journal_media write: every insert, update and delete.
    async changes({ since, limit }) {
      const head = await journalMediaRepo.journalMediaChangeCursor(db);
      if (!/^(0|[1-9]\d{0,15})$/.test(since) || Number(since) > head) {
        throw new RefusedError("That change cursor is not this site's; reload the library.");
      }
      const changed = await journalMediaRepo.journalMediaChangedSince(
        db,
        Number(since),
        head,
        limit,
      );
      const more = changed.length > limit;
      const taken = changed.slice(0, limit);
      const rows = new Map(
        (
          await journalMediaRepo.getJournalMediaMany(
            db,
            taken.map((c) => c.key),
          )
        ).map((r) => [r.key, r]),
      );
      return {
        items: taken.flatMap((c) => {
          const found = rows.get(c.key);
          return found ? [itemOf(found, found.usedCount)] : [];
        }),
        removed: taken.filter((c) => !rows.has(c.key)).map((c) => c.key),
        cursor: String(more ? (taken[limit - 1]?.seq ?? head) : head),
        more,
      };
    },

    // Never applied: Carrel shows them, and a person accepts each as an alt or a tags write.
    async suggest(id) {
      const file = await journalMediaRepo.getJournalMedia(db, id);
      if (!file) return null;
      const object = await env.MEDIA.get(id);
      if (!object) return null;
      try {
        return await suggestFor(env, object.body);
      } catch (error) {
        throw new RefusedError(
          `No suggestion was made: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
