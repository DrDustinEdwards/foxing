// Catalog endpoints: public, viewer-independent reads (books, authors, search), so
// each answer is cacheable at the edge.
import { views } from "@foxing/core";
import { Hono } from "hono";
import type { Env } from "../types";

export const catalogRoutes = new Hono<Env>();

const EDGE_CACHE = { "Cache-Control": "public, max-age=30, s-maxage=300" };

catalogRoutes.get("/search/suggest", async (c) => {
  return c.json(await views.suggest(c.get("db"), c.req.query("q") ?? ""), 200, EDGE_CACHE);
});
