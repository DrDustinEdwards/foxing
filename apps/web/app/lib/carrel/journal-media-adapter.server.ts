// The Journal's media library, as site-api's media group for Carrel (mediaLibrary): uploads for a
// Journal post's cover and inline images. Editorial only: it is reached with the Carrel key alone,
// and nothing a reader can call uploads an image (posts by readers carry none, Capsid
// foxing/do-not-build.md). Book covers are not in it: books.cover_url and its covers.foxing.app
// files are left as they are, and a Journal cover may still be any pasted https address.
//
// Storage: the bytes in the MEDIA R2 bucket under journal/ (never a reader/ key), served by the
// Worker at /media/<key> (workers/app.ts); the index in D1 (journal_media, @foxing/core's
// journalMediaRepo, mapped below to site-api's MediaRecord); every earlier set of bytes, and a
// deleted file's last ones, copied to the private BACKUPS bucket under journal-media/ first and
// never deleted from there (backup.server.ts copies that prefix on to files/journal-revisions/).
// Everything else (versions, lists, lenses, history, revert, shrink, turns) is site-api's.

import {
  datedKey,
  type MediaAdapter,
  type MediaLibraryStore,
  type MediaRecord,
  type MediaRecordFields,
  type MediaRevisionRecord,
  type MediaUse,
  mediaLibrary,
} from "@dustinedwards/site-api";
import { createDb, type Db, journalMediaRepo } from "@foxing/core";
import { SITE_ORIGIN } from "../origins";
import { suggestFor } from "./media-suggest.server";

type Row = journalMediaRepo.JournalMediaRow;
type Revision = journalMediaRepo.JournalMediaRevision;

/** What an upload shrinks to unless it says `resize=no`: Journal pages show a picture at most the
 * column's width, about 1,200 CSS pixels, so 2,560 keeps it sharp on a 2x screen. */
const RESIZE = { maxEdge: 2560, quality: 85 };

/** Large enough for a camera file, which the upload then shrinks. HEIC and HEIF are stored as JPEG. */
const LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  types: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/heic",
    "image/heif",
  ],
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function recordOf(row: Row): MediaRecord {
  const { uploadedAt, trashedAt, ...rest } = row;
  return { ...rest, uploadedAt: uploadedAt.toISOString(), trashedAt: iso(trashedAt) };
}

/** A write's fields as columns: the dates as Date; sha256 is never null on a write the library makes. */
function fieldsOf(fields: MediaRecordFields): journalMediaRepo.JournalMediaFields {
  const {
    uploadedAt,
    trashedAt,
    sha256,
    decorative,
    copyright,
    licenseUrl,
    acquireLicenseUrl,
    ...rest
  } = fields;
  return {
    ...rest,
    ...(sha256 ? { sha256 } : {}),
    ...(uploadedAt !== undefined ? { uploadedAt: new Date(uploadedAt) } : {}),
    ...(trashedAt !== undefined
      ? { trashedAt: trashedAt === null ? null : new Date(trashedAt) }
      : {}),
  };
}

function revisionOf(row: Revision): MediaRevisionRecord {
  return {
    id: row.id,
    at: row.at.toISOString(),
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    reason: row.reason as MediaRevisionRecord["reason"],
    sha256: row.sha256,
    copyKey: row.backupKey,
  };
}

/** The library's store over journal_media, its revisions and its change log. */
function journalMediaStore(db: Db): MediaLibraryStore {
  const one = async (key: string) => {
    const row = await journalMediaRepo.getJournalMedia(db, key);
    return row ? recordOf(row) : null;
  };
  return {
    record: one,
    records: async (keys) => (await journalMediaRepo.getJournalMediaMany(db, keys)).map(recordOf),
    all: async () => (await journalMediaRepo.allJournalMedia(db)).map(recordOf),
    async byHash(sha256) {
      const row = await journalMediaRepo.journalMediaByHash(db, sha256);
      return row ? recordOf(row) : null;
    },
    async insert(record) {
      const { key, contentType, bytes } = record;
      const fields = fieldsOf(record);
      await journalMediaRepo.insertJournalMedia(db, {
        ...fields,
        key,
        contentType,
        bytes,
        sha256: record.sha256 ?? "",
        uploadedAt: new Date(record.uploadedAt),
      });
    },
    async writeAtRev(key, fields, expectedRev) {
      const written = await journalMediaRepo.writeJournalMediaAtRev(
        db,
        key,
        fieldsOf(fields),
        expectedRev,
      );
      return written.ok ? { ok: true, record: recordOf(written.row) } : written;
    },
    async follow(key, fields) {
      const row = await journalMediaRepo.followJournalMedia(db, key, fieldsOf(fields));
      if (!row) throw new Error(`${key} changed its bytes, but its row is gone`);
      return recordOf(row);
    },
    addRevision: (key, revision) =>
      journalMediaRepo.addJournalMediaRevision(db, {
        mediaKey: key,
        at: new Date(revision.at),
        bytes: revision.bytes,
        width: revision.width,
        height: revision.height,
        reason: revision.reason,
        sha256: revision.sha256,
        backupKey: revision.copyKey,
      }),
    revisions: async (key, limit) =>
      (await journalMediaRepo.listJournalMediaRevisions(db, key, limit)).map(revisionOf),
    keepCopy: (revisionId, copyKey) =>
      journalMediaRepo.keepJournalMediaRevision(db, revisionId, copyKey),
    remove: (key, rev) => journalMediaRepo.removeJournalMedia(db, key, rev),
    changeCursor: () => journalMediaRepo.journalMediaChangeCursor(db),
    changedSince: (from, head, limit) =>
      journalMediaRepo.journalMediaChangedSince(db, from, head, limit),
  };
}

/** The Journal's own reference check: each post whose cover or body names a file's address. */
async function usesOf(db: Db, keys?: string[]): Promise<Map<string, MediaUse[]>> {
  const uses = new Map<string, MediaUse[]>();
  for (const use of await journalMediaRepo.journalMediaUses(db, keys)) {
    const detail =
      use.inCover && use.inBody ? "cover image and body" : use.inCover ? "cover image" : "body";
    const list = uses.get(use.key) ?? [];
    list.push({ type: "journal", id: use.slug, title: use.title.slice(0, 1000), detail });
    uses.set(use.key, list);
  }
  return uses;
}

export function journalMediaAdapter(options: {
  env: Env;
  /** Records one write in admin_audit_log with Carrel's changeId. */
  audit: (action: string, params: Record<string, unknown>) => Promise<void>;
}): MediaAdapter {
  const { env, audit } = options;
  const db = createDb(env.DB);
  return mediaLibrary({
    store: journalMediaStore(db),
    bucket: env.MEDIA,
    images: env.IMAGES,
    limits: LIMITS,
    // Absolute, as the Journal's cover_image_url must be.
    url: (key) => `${SITE_ORIGIN}${journalMediaRepo.JOURNAL_MEDIA_PATH}${key}`,
    // journal/<yyyy>/<mm>/<name>-<hash>.<ext>: the only MEDIA prefix the /media route serves.
    key: datedKey("journal/"),
    // No Journal page is sized by a file's address (pages name the bytes' hash,
    // lib/journal-images.server.ts), so a replace may change a picture's size and a turn turns in place.
    resize: RESIZE,
    usage: (keys) => usesOf(db, keys),
    // BACKUPS is private and never served.
    history: { bucket: env.BACKUPS, prefix: "journal-media/replaced/" },
    customMetadata: (record): Record<string, string> =>
      record.filename ? { originalName: record.filename } : {},
    onWrite: ({ op, id, changeId, newId }) =>
      audit(`journal-media.${op}`, { key: id, changeId, ...(newId ? { newId } : {}) }),
    suggest: (picture, id) => suggestFor(env, picture, id),
    // The package checks every address and each redirect before this fetch runs.
    importFetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, init)) as typeof fetch,
  });
}
