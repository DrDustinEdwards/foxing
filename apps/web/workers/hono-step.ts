import { IMMUTABLE_CACHE } from "@dustinedwards/site-runtime/image";
import { r2ObjectResponse } from "@dustinedwards/site-runtime/r2-object";
import { refuseCrossSite } from "@dustinedwards/site-runtime/origin";
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import { authHandler } from "@dustinedwards/site-runtime/sign-in-form";
import type { GatewayStep } from "@dustinedwards/site-runtime/worker";
import { createApi } from "@foxing/api";
import { billing } from "@foxing/core";
import { Hono } from "hono";
import { anthropicCaller, anthropicStructured } from "../app/lib/anthropic.server";
import { edgeCache } from "../app/lib/cache.server";
import { images } from "../app/lib/images";
import {
  deleteUserAccount,
  getAuth,
  isFreshSession,
  sessionUserFromRequest,
} from "../app/lib/auth.server";
import { readerAssetContentType } from "../app/lib/reader-asset-type";
import { clubRoomHub } from "./club-room";

// Injected at build time (vite define): namespaces the search suggestions' cache per deploy.
declare const __CACHE_VERSION__: string;

function suggestKeyFor(url: URL): Request {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__v", __CACHE_VERSION__);
  return new Request(keyUrl.toString(), { method: "GET" });
}

const api = createApi({
  resolveSession: (req, env) => sessionUserFromRequest(req, env as unknown as Env),
  isFresh: (req, env) => isFreshSession(req, env as unknown as Env),
  deleteUser: (req, env, { successors }) =>
    deleteUserAccount(req, env as unknown as Env, successors),
  checkAdminAccess: async (req, env, email) =>
    (await accessAdmin(req, env as unknown as Env, { admins: [email] })) !== null,
  // Without ANTHROPIC_API_KEY only companion calls fail, cleanly.
  resolveStructuredCaller: (env) => anthropicStructured(env as unknown as Env),
  resolveCompanionCaller: (env) => {
    const caller = anthropicCaller(env as unknown as Env);
    if (caller) return caller;
    // oxlint-disable-next-line eslint/require-yield -- throws on first iteration by design, never yields
    return async function* missingKey() {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Run: wrangler secret put ANTHROPIC_API_KEY",
      );
    };
  },
  // Without all four Stripe secrets the stub makes billing routes 503 and the pages offer no upgrade.
  resolveBilling: (env) => {
    const stripe = billing.stripeSettings(env as unknown as Env);
    if (!stripe)
      return { client: billing.notConfiguredBilling(), prices: { monthly: "", annual: "" } };
    return {
      client: billing.createStripeBilling({
        secretKey: stripe.secretKey,
        webhookSecret: stripe.webhookSecret,
      }),
      prices: stripe.prices,
    };
  },
  resolveHub: (env) => clubRoomHub((env as unknown as Env).CLUB_ROOM),
});

const app = new Hono<{ Bindings: Env }>();

// Not-found answers (a missing reader asset or picture) are plainNotFound, a real 404.
const PASS = "x-foxing-pass";
app.notFound(() => new Response(null, { status: 404, headers: { [PASS]: "1" } }));
const plainNotFound = () => new Response("Not found", { status: 404 });

// Better Auth answers carry sessions and passkey challenges, so no browser or proxy keeps one.
app.on(["GET", "POST"], "/api/auth/*", async (c) => authHandler(await getAuth(c.env), c.req.raw));

// Every write is an /api/v1 route that skips React Router's Origin check, so a cross-origin browser write is refused
// here. An absent Origin passes (mobile app, admin MCP bearer calls, Stripe's webhook).
app.use("/api/v1/*", async (c, next) => refuseCrossSite(c.req.raw) ?? next());

// Search-as-you-type answers do not depend on the viewer, so the edge cache serves everyone.
app.get("/api/v1/search/suggest", async (c, next) => {
  const cache = edgeCache();
  const key = suggestKeyFor(new URL(c.req.url));
  const hit = await cache.match(key);
  if (hit) return hit;
  await next();
  if (c.res.status === 200) c.executionCtx.waitUntil(cache.put(key, c.res.clone()));
});

app.route("/api/v1", api);

// Readium reader assets are served same-origin (no CORS for the HttpFetcher) from MEDIA under reader/<slug>/...;
// noindex keeps duplicate book text out of search.
app.get("/reader-assets/*", async (c) => {
  const url = new URL(c.req.url);
  let rest: string;
  try {
    rest = decodeURIComponent(url.pathname.replace(/^\/reader-assets\//, ""));
  } catch {
    return plainNotFound(); // a malformed escape
  }
  if (!rest || rest.includes("..")) return plainNotFound();

  const cache = edgeCache();
  // stored=2 abandons copies cached while stored pages lacked the XML declaration's closing "?" (immutable, so they would live a year).
  const mediaRequest = new Request(`${url.toString()}${url.search ? "&" : "?"}stored=2`, {
    method: "GET",
  });
  if (c.req.method === "GET") {
    const cached = await cache.match(mediaRequest);
    if (cached) return cached;
  }
  const res = await r2ObjectResponse(c.req.raw, readerAssets(c.env.MEDIA, rest), `reader/${rest}`, {
    cacheControl: IMMUTABLE_CACHE,
    noindex: true,
  });
  if (res.status === 200 && c.req.method === "GET")
    c.executionCtx.waitUntil(cache.put(mediaRequest, res.clone()));
  return res;
});

/**
 * The MEDIA bucket as the reader's files. A book's own scripts never run: Readium's frames are same-origin, so the
 * CSP ('self') would let an EPUB's external <script src> load; text/plain plus nosniff makes the browser refuse it.
 */
function readerAssets(bucket: R2Bucket, path: string) {
  const typed = <T extends R2Object | null>(object: T): T => {
    if (!object) return object;
    return new Proxy(object, {
      get(target, property) {
        if (property === "writeHttpMetadata")
          return (headers: Headers) => {
            target.writeHttpMetadata(headers);
            const stored = headers.get("Content-Type") ?? readerAssetContentType(path);
            headers.set(
              "Content-Type",
              /javascript|ecmascript/i.test(stored) ? "text/plain; charset=utf-8" : stored,
            );
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  return {
    head: async (key: string) => typed(await bucket.head(key)),
    get: async (key: string, options?: { range?: Headers }) =>
      typed(await bucket.get(key, options)),
  };
}

// Covers from COVERS under covers/ and the Journal's media from MEDIA under journal/ only, so no other key is served
// here. A size is a year-long immutable copy; a Journal address without its `v` (a replace keeps the key) an hour.
app.get("/media/*", (c) =>
  images.serve(c.req.raw, {
    read: (key) =>
      key.startsWith("covers/")
        ? c.env.COVERS.get(key.slice("covers/".length))
        : key.startsWith("journal/")
          ? c.env.MEDIA.get(key)
          : Promise.resolve(null),
    images: c.env.IMAGES,
    cache: edgeCache(),
    cacheControl: ({ key, url }) =>
      key.startsWith("covers/") || url.searchParams.has("v")
        ? IMMUTABLE_CACHE
        : "public, max-age=3600",
  }),
);

// Writes that can change a stored page beside Carrel's (the admin API, MCP included, and a reader's visibility: a
// profile going private must drop its cached recap card). Each accepted one purges every stored page.
const PAGE_WRITERS = ["/api/v1/admin", "/api/v1/me/visibility"];

export const hono: GatewayStep<Env> = async (request, env, ctx, kit) => {
  const answer = await app.fetch(request, env, ctx);
  if (answer.headers.has(PASS)) return undefined;
  const { pathname } = kit.url;
  if (PAGE_WRITERS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    kit.purgeAfterWrite(request, answer, `${request.method} ${pathname}`);
  return answer;
};
