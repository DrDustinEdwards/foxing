// D1 + Drizzle handle. Built per-request from the DB binding (D1 is request-scoped).
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = DrizzleD1Database<Schema>;

// D1 refuses a statement with more than 100 bound parameters ("too many SQL variables").
// Every IN list and every multi-row insert is cut to fit, through these two, so the limit
// is written once.
export const D1_MAX_BOUND_PARAMS = 100;
/** The longest IN list, with room left for the query's other parameters. */
export const IN_LIST_CHUNK = 90;

/** `items` in slices of at most `size`, in order. */
export function chunked<T>(items: readonly T[], size: number = IN_LIST_CHUNK): T[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** How many rows of a table one INSERT may carry: every column can be a bound parameter. */
export function rowsPerInsert(columns: number): number {
  return Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columns));
}

// D1 occasionally throws at statement execution for reasons unrelated to the query:
// a lost edge connection, a storage object reset, or an isolate cold-start blip.
// These surface as one-off exceptions that a retry clears. Reads are idempotent, so
// we retry them with a short backoff. Writes (`run`, `batch`) are never retried, to
// avoid re-applying a mutation whose response was merely lost in transit.
const READ_METHODS = new Set(["first", "all", "raw"]);
const MAX_ATTEMPTS = 3;

async function withReadRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS - 1) break;
      // 20ms, then 60ms. Enough to clear a transient reset without adding user-visible lag.
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt * 2 + 1)));
    }
  }
  throw lastErr;
}

function wrapStatement(stmt: D1PreparedStatement): D1PreparedStatement {
  return new Proxy(stmt, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      // `bind` returns a fresh statement; keep it wrapped so its executor retries too.
      if (prop === "bind") {
        return (...args: unknown[]) =>
          wrapStatement((value as (...a: unknown[]) => D1PreparedStatement).apply(target, args));
      }
      if (typeof prop === "string" && READ_METHODS.has(prop)) {
        return (...args: unknown[]) =>
          withReadRetry(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
      }
      return value.bind(target);
    },
  });
}

// Exported for unit testing the retry behavior with a fake D1 binding.
export function wrapD1(d1: D1Database): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop === "prepare") {
        return (sql: string) =>
          wrapStatement((value as (s: string) => D1PreparedStatement).call(target, sql));
      }
      return value.bind(target);
    },
  });
}

export function createDb(d1: D1Database): Db {
  return drizzle(wrapD1(d1), { schema });
}
