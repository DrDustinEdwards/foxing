// The Journal's media library as site-api's media group; editorial only (Carrel key alone, no reader-callable upload). Bytes live in MEDIA under journal/;
// earlier and deleted bytes are copied to BACKUPS journal-media/ first and never deleted from there.

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
  audit: (action: string, params: Record<string, unknown>) => Promise<void>;
}): MediaAdapter {
  const { env, audit } = options;
  const db = createDb(env.DB);
  return mediaLibrary({
    store: d1MediaStore(env.DB, { inUse: journalMediaRepo.JOURNAL_MEDIA_IN_USE }),
    bucket: env.MEDIA,
    images: env.IMAGES,
    limits: pictureLimits(),
    url: (key) => `${SITE_ORIGIN}${journalMediaRepo.JOURNAL_MEDIA_PATH}${key}`,
    key: datedKey("journal/"),
    resize: PICTURE_RESIZE,
    usage: (keys) => usesOf(db, keys),
    history: { bucket: env.BACKUPS, prefix: "journal-media/replaced/" },
    customMetadata: (record): Record<string, string> =>
      record.filename ? { originalName: record.filename } : {},
    onWrite: ({ op, id, changeId, newId }) =>
      audit(`journal-media.${op}`, { key: id, changeId, ...(newId ? { newId } : {}) }),
    suggest: (picture, id) => suggestFor(env, picture, id),
  });
}
