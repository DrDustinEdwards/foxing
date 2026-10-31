// Catalog endpoints: public, viewer-independent reads (books, authors, search), so
// each answer is cacheable at the edge. Recommendations are the one per-reader read.
import { getRecommendations, views } from "@foxing/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { errors } from "../error";
import { requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const catalogRoutes = new Hono<Env>();

const EDGE_CACHE = { "Cache-Control": "public, max-age=30, s-maxage=300" };

function catalogQuery(c: Context<Env>): views.CatalogQuery {
  return {
    subject: c.req.query("subject"),
    era: c.req.query("era"),
    length: c.req.query("length"),
    sort: c.req.query("sort"),
    page: Math.max(1, Number(c.req.query("page")) || 1),
  };
}

catalogRoutes.get("/search/suggest", async (c) => {
  return c.json(await views.suggest(c.get("db"), c.req.query("q") ?? ""), 200, EDGE_CACHE);
});

catalogRoutes.get("/discover", async (c) => {
  return c.json(await views.discover(c.get("db")), 200, EDGE_CACHE);
});

catalogRoutes.get("/search", async (c) => {
  const page = await views.search(c.get("db"), c.req.query("q") ?? "", catalogQuery(c));
  return c.json(page, 200, EDGE_CACHE);
});

catalogRoutes.get("/books", async (c) => {
  return c.json(await views.browse(c.get("db"), catalogQuery(c)), 200, EDGE_CACHE);
});

catalogRoutes.get("/books/:idOrSlug", async (c) => {
  const page = await views.bookPage(c.get("db"), c.req.param("idOrSlug"), {
    amazonTag: c.env.AMAZON_ASSOC_TAG || null,
    bookshopId: c.env.BOOKSHOP_AFFILIATE_ID || null,
  });
  if (!page) throw errors.notFound("Book not found.");
  return c.json(page, 200, EDGE_CACHE);
});

// Per reader (saved position, their clubs), so never edge-cached.
catalogRoutes.get("/books/:idOrSlug/reader", async (c) => {
  const page = await views.readerPage(
    c.get("db"),
    c.get("session")?.id ?? null,
    c.req.param("idOrSlug"),
  );
  if (!page) throw errors.notFound("Book not found.");
  return c.json(page);
});

catalogRoutes.get("/authors/:slug", async (c) => {
  const author = await views.author(c.get("db"), c.req.param("slug"));
  if (!author) throw errors.notFound("Author not found.");
  return c.json(author, 200, EDGE_CACHE);
});

// ?refresh=1 asks the AI tier for a fresh pick (Plus only, rate-limited like a write).
catalogRoutes.get("/recommendations", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const set = await getRecommendations(c.get("db"), session.id, {
    caller: c.get("structuredCompanion"),
    kv: c.env.APP_KV,
    refresh: c.req.query("refresh") === "1",
  });
  return c.json(set);
});
