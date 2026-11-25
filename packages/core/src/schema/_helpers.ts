// Shared column builders. SQLite via Drizzle, D1 conventions (spec-cf-schema rev 3):
// text nanoid PKs, integer timestamp_ms, integer booleans, text json.
import { type AnySQLiteColumn, integer, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const idPk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

export const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export const bool = (name: string) => integer(name, { mode: "boolean" });

export const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export const cascadeFk = (name: string, target: () => AnySQLiteColumn) =>
  text(name).notNull().references(target, { onDelete: "cascade" });
