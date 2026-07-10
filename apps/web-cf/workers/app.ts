// Single Worker entry. Hono is the root fetch handler and delegates:
//   /api/auth/*  -> Better Auth
//   /api/v1/*    -> mounted @foxing/api (thin routes -> core -> D1)
//   everything   -> React Router SSR
// Order matters: API routes register before the React Router catch-all.
import { AppError, createApi, rateLimit } from "@foxing/api";
import { Hono } from "hono";
import { RouterContextProvider, createRequestHandler } from "react-router";
import { cloudflareContext } from "../app/context";
import { edgeCache } from "../app/lib/cache.server";
import { getAuth } from "../app/lib/auth.server";

// Public catalog surfaces are anonymous and safe to cache at the edge. Segment
// prefixes match the path or any child (/books, /books/x), not lookalikes (/booksy).
const PUBLIC_EXACT = new Set(["/", "/sitemap.xml", "/robots.txt", "/privacy", "/terms"]);
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

// Injected at build time (vite define). Namespaces the edge cache per deploy.
declare const __CACHE_VERSION__: string;

/** Cache key = the request URL plus the build id, so a new deploy starts fresh. */
function cacheKeyFor(url: URL): Request {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", __CACHE_VERSION__);
  return new Request(keyUrl.toString(), { method: "GET" });
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

// The wired AUTH_RL class (5/min/IP). Applied to credential submissions below.
const authLimiter = rateLimit("auth");

// The password reset link is a GET navigation Better Auth handles directly. If the
// token lookup fails unexpectedly (a D1 blip that outlives the retry, say), Better
// Auth would answer with a raw 500 or its own "Something went wrong" page. For that
// one navigation we intercept and send the user to the friendly /reset-password
// screen, which offers a retry link. Every other auth route is untouched.
function isResetCallback(req: Request): boolean {
  if (req.method !== "GET") return false;
  return new URL(req.url).pathname.startsWith("/api/auth/reset-password/");
}

function friendlyResetRedirect(req: Request): Response {
  const to = new URL("/reset-password", req.url);
  to.searchParams.set("error", "unavailable");
  return Response.redirect(to.toString(), 302);
}

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const req = c.req.raw;
  // Credential-stuffing defense: throttle credential submissions (POST: sign-in,
  // sign-up, password-reset requests) with the wired AUTH_RL class (5/min/IP). GET
  // navigations (session checks, the reset callback) are not throttled. The class
  // throws AppError on limit; the root app has no onError, so convert it here.
  if (req.method === "POST") {
    try {
      await authLimiter(c as never, async () => {});
    } catch (err) {
      if (err instanceof AppError) {
        return c.json({ error: { code: err.code, message: err.message } }, 429);
      }
      throw err;
    }
  }
  try {
    const res = await getAuth(c.env).handler(req);
    if (isResetCallback(req)) {
      const location = res.headers.get("Location") ?? "";
      if (res.status >= 500 || location.includes("/api/auth/error")) {
        return friendlyResetRedirect(req);
      }
    }
    return res;
  } catch (err) {
    if (isResetCallback(req)) return friendlyResetRedirect(req);
    throw err;
  }
});

app.route("/api/v1", api);

app.all("*", async (c) => {
  const req = c.req.raw;
  const url = new URL(req.url);
  // Cache anonymous GETs on public paths. A Better Auth session cookie means the
  // request may be personalized later, so bypass the cache to stay correct.
  const authed = (req.headers.get("Cookie") ?? "").includes("better-auth");
  const cacheable = req.method === "GET" && isPublicPath(url.pathname) && !authed;
  const cache = edgeCache();
  const key = cacheKeyFor(url);

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
