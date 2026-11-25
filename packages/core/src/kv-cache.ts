// A KV-held TTL copy of a public read that every request repeats and that changes rarely (nav featured clubs, genre facets). KV is global but
// eventually consistent: a write can take up to 60 seconds to reach other locations, and the TTL cannot be under 60 seconds. A module-level memo
// is out (Workers keep no module state; isolates are many and short-lived) and the Cache API stores Responses, not rows.
// The KV handle rides on the Db handle (createDb's second argument); the read-through is site-runtime's kvCached. A Db without one reads
// straight through; a throwing read is not kept; a KV fault never fails the read. Stale up to `ttlSeconds`: never use it for what a person just wrote.
import { kvCached, type KvLike } from "@dustinedwards/site-runtime/kv-cache";

import type { Db } from "./db";

export type { KvLike };

const handles = new WeakMap<object, KvLike>();

export function attachKv(db: Db, kv: KvLike | null | undefined): Db {
  if (kv) handles.set(db, kv);
  return db;
}

export function cachedRead<T>(
  db: Db,
  key: string,
  ttlSeconds: number,
  read: () => Promise<T>,
): Promise<T> {
  return kvCached(handles.get(db), key, { ttl: ttlSeconds }, read);
}
