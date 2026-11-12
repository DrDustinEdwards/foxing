// D1 + Drizzle handle. Built per-request from the DB binding (D1 is request-scoped).
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { attachKv, type KvLike } from "./kv-cache";

export type Schema = typeof schema;
export type Db = DrizzleD1Database<Schema>;

// D1's statement limits (100 bound parameters) live in site-runtime ./d1, one copy for every site.
export {
  chunked,
  D1_MAX_BOUND_PARAMS,
  IN_LIST_CHUNK,
  inList,
  rowsPerInsert,
} from "@dustinedwards/site-runtime/d1";

// No read retry here: D1 retries read-only queries itself, up to two more times, and rolls back any retry that wrote
// (https://developers.cloudflare.com/d1/observability/debug-d1/#automatic-retries). A wrapper that retried every
// `all`/`raw` call also retried Drizzle's INSERT ... RETURNING, which runs through them.
export function createDb(d1: D1Database, kv?: KvLike | null): Db {
  return attachKv(drizzle(d1, { schema }), kv);
}
