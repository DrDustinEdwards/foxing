// The Journal's media library, as site-api's media group for Carrel (mediaLibrary): uploads for a
// Journal post's cover and inline images. Editorial only: it is reached with the Carrel key alone,
// and nothing a reader can call uploads an image (posts by readers carry none, Capsid
// foxing/do-not-build.md). Book covers are not in it: books.cover_url and its covers.foxing.app
// files are left as they are, and a Journal cover may still be any pasted https address.
//
// Storage: the bytes in the MEDIA R2 bucket under journal/ (never a reader/ key), served by the
// Worker at /media/<key> (workers/app.ts); the index in D1, site-api's standard tables written by
// its d1MediaStore (@foxing/core schema/media.ts describes them for the Journal's reads); every
// earlier set of bytes, and a deleted file's last ones, copied to the private BACKUPS bucket
// under journal-media/ first and never deleted from there (backup.server.ts copies that prefix on to files/journal-revisions/).
// Everything else (versions, lists, lenses, history, revert, shrink, turns) is site-api's.

import {
  PICTURE_RESIZE,
  pictureLimits,
  d1MediaStore,
  datedKey,
  type MediaAdapter,
  type MediaUse,
  mediaLibrary,
} from "@dustinedwards/site-api";
import { createDb, type Db, journalMediaRepo } from "@foxing/core";
import { SITE_ORIGIN } from "../origins";
import { suggestFor } from "./media-suggest.server";

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
    store: d1MediaStore(env.DB, { inUse: journalMediaRepo.JOURNAL_MEDIA_IN_USE }),
    bucket: env.MEDIA,
    images: env.IMAGES,
    limits: pictureLimits(),
    // Absolute, as the Journal's cover_image_url must be.
    url: (key) => `${SITE_ORIGIN}${journalMediaRepo.JOURNAL_MEDIA_PATH}${key}`,
    // journal/<yyyy>/<mm>/<name>-<hash>.<ext>: the only MEDIA prefix the /media route serves.
    key: datedKey("journal/"),
    // No Journal page is sized by a file's address (pages name the bytes' hash,
    // lib/journal-images.server.ts), so a replace may change a picture's size and a turn turns in place.
    resize: PICTURE_RESIZE,
    usage: (keys) => usesOf(db, keys),
    // BACKUPS is private and never served.
    history: { bucket: env.BACKUPS, prefix: "journal-media/replaced/" },
    customMetadata: (record): Record<string, string> =>
      record.filename ? { originalName: record.filename } : {},
    onWrite: ({ op, id, changeId, newId }) =>
      audit(`journal-media.${op}`, { key: id, changeId, ...(newId ? { newId } : {}) }),
    suggest: (picture, id) => suggestFor(env, picture, id),
  });
}
