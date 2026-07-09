// D1 + Drizzle handle. Built per-request from the DB binding (D1 is request-scoped).
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = DrizzleD1Database<Schema>;

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

function wrapD1(d1: D1Database): D1Database {
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
