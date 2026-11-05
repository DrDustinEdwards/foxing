// A KV-held copy of a public read that every request repeats and that changes rarely (the nav's featured clubs, the
// genre facets): a counting query over most of a table, run on every page. Same pattern as the Ask drift badge on
// dustinedwards.info: a TTL entry in the site's APP_KV. KV is global but eventually consistent, so a fresh write can
// take up to 60 seconds to reach other locations, and the TTL cannot be under 60 seconds
// (developers.cloudflare.com/kv/api/write-key-value-pairs/). A module-level memo would not do: Workers best practice
// is to keep no state in module scope (developers.cloudflare.com/workers/best-practices/workers-best-practices/),
// and isolates are many and short-lived. The Cache API is per data center and stores Responses, not rows.
//
// The KV handle rides on the Db handle (createDb's second argument), so the reads keep their signatures. A Db made
// without one reads straight through. A read that throws is not kept; a KV fault never fails the read. Stale at most
// `ttlSeconds` (plus KV's propagation): never use this for anything a person just wrote and expects to see.
import type { Db } from "./db";

export interface KvLike {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

const handles = new WeakMap<object, KvLike>();

export function attachKv(db: Db, kv: KvLike | null | undefined): Db {
  if (kv) handles.set(db, kv);
  return db;
}

export async function cachedRead<T>(
  db: Db,
  key: string,
  ttlSeconds: number,
  read: () => Promise<T>,
): Promise<T> {
  const kv = handles.get(db);
  if (!kv) return read();
  try {
    const kept = await kv.get(key, "json");
    if (kept !== null && kept !== undefined) return kept as T;
  } catch {
    // An unreadable entry is a miss.
  }
  const value = await read();
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
  } catch {
    // A failed write costs one more read, never the answer.
  }
  return value;
}
