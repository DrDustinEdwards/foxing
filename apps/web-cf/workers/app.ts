// Single Worker entry. Hono is the root fetch handler and delegates:
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   everything   -> React Router SSR
// Order matters: API routes register before the React Router catch-all.
import { createApi } from "@foxing/api";
import { Hono } from "hono";
import { RouterContextProvider, createRequestHandler } from "react-router";
import { cloudflareContext } from "../app/context";
import { edgeCache } from "../app/lib/cache.server";
import { getAuth } from "../app/lib/auth.server";

// Public catalog surfaces are anonymous and safe to cache at the edge. Segment
// prefixes match the path or any child (/books, /books/x), not lookalikes (/booksy).
const PUBLIC_EXACT = new Set(["/", "/sitemap.xml", "/robots.txt"]);
const PUBLIC_PREFIXES = [
  "/books",
  "/authors",
  "/awards",
  "/picks",
  "/book-of-the-month",
  "/journal",
  "/search",
  "/og",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const api = createApi({
  resolveSession: async (req, env) => {
    const session = await getAuth(env as unknown as Env).api.getSession({ headers: req.headers });
    if (!session?.user) return null;
    return { id: session.user.id, email: session.user.email };
  },
});

const app = new Hono<{ Bindings: Env }>();

app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.route("/api/v1", api);

app.all("*", async (c) => {
  const req = c.req.raw;
  const url = new URL(req.url);
  // Cache anonymous GETs on public paths. A Better Auth session cookie means the
  // request may be personalized later, so bypass the cache to stay correct.
  const authed = (req.headers.get("Cookie") ?? "").includes("better-auth");
  const cacheable = req.method === "GET" && isPublicPath(url.pathname) && !authed;
  const cache = edgeCache();
  const key = new Request(url.toString(), { method: "GET" });

  if (cacheable) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: c.env,
    ctx: c.executionCtx as unknown as ExecutionContext,
  });
  const res = await reactRouterHandler(req, context);

  // Only cache successful responses that opted in with an s-maxage directive.
  if (
    cacheable &&
    res.status === 200 &&
    (res.headers.get("Cache-Control") ?? "").includes("s-maxage")
  ) {
    c.executionCtx.waitUntil(cache.put(key, res.clone()));
  }
  return res;
});

export default app;
