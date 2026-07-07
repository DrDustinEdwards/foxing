// Shared column builders. SQLite via Drizzle, D1 conventions (spec-cf-schema rev 3):
// text nanoid PKs, integer timestamp_ms, integer booleans, text json.
import { integer, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/** text primary key, server-defaulted to a nanoid (clients MAY supply their own). */
export const idPk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

/** created_at, defaulted to insert time. */
export const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/** updated_at, defaulted to insert time; core bumps it on every update. */
export const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/** a timestamp_ms column (nullable by default). */
export const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

/** an integer-backed boolean column. */
export const bool = (name: string) => integer(name, { mode: "boolean" });

/** a text column carrying JSON, typed as T. */
export const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
