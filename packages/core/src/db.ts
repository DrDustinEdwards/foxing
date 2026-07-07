// D1 + Drizzle handle. Built per-request from the DB binding (D1 is request-scoped).
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = DrizzleD1Database<Schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}
