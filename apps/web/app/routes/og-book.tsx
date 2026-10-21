import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { catalogRepo } from "@foxing/core";
import { ImageResponse } from "workers-og";
import { edgeCache } from "~/lib/cache.server";
import { coverSrc } from "~/lib/images";
import { loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/og-book";
import { FONT_CACHE_ORIGIN, OG_CACHE_ORIGIN, SITE_ORIGIN } from "~/lib/origins";

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Load a font satori can use. A legacy UA makes Google Fonts serve WOFF (satori
 * supports ttf/otf/woff, not woff2). Cached at the edge for a year.
 */
async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${FONT_CACHE_ORIGIN}/${family}-${weight}.font`;
  const cache = edgeCache();
  const hit = await cache.match(key);
  if (hit) return hit.arrayBuffer();
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)" } },
    ).then((r) => r.text());
    const url = css.match(
      /src:\s*url\((.+?)\)\s*format\(['"]?(?:woff|truetype|opentype)['"]?\)/,
    )?.[1];
    if (!url) return null;
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    await cache.put(
      key,
      new Response(buf, { headers: { "Cache-Control": "public, max-age=31536000" } }),
    );
    return buf;
  } catch {
    return null;
  }
}

async function coverDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(coverSrc(url, 480));
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 8192) {
      binary += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const book = await catalogRepo.getBookBySlug(db, params.slug);
  if (!book) throw new Response("Not found", { status: 404 });

  const cacheKey = new Request(
    `${OG_CACHE_ORIGIN}/book/${book.slug}?v=${book.updatedAt?.getTime() ?? 0}`,
  );
  const cache = edgeCache();
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [display, ui, cover] = await Promise.all([
    loadFont("Fraunces", 600),
    loadFont("DM Sans", 500),
    book.coverUrl ? coverDataUri(book.coverUrl) : Promise.resolve(null),
  ]);

  // No usable font: fall back to the cover image (or 302 home) so crawlers still get art.
  if (!display && !ui) {
    return Response.redirect(book.coverUrl ?? SITE_ORIGIN, 302);
  }

  const title = escapeHtml(book.title.length > 80 ? `${book.title.slice(0, 77)}...` : book.title);
  const author = escapeHtml(book.author);

  // Single line, no whitespace between tags: satori counts whitespace text nodes as
  // children and requires display:flex on any multi-child element.
  const titleFamily = display ? "Fraunces" : "DM Sans";
  const coverBlock = cover
    ? `<div style="display:flex;width:340px;height:100%;align-items:center;"><img src="${cover}" width="340" height="510" style="border-radius:10px;object-fit:cover;box-shadow:0 20px 45px rgba(22,16,11,0.28);"/></div>`
    : "";
  const html =
    `<div style="display:flex;width:100%;height:100%;background:#FAF6EE;font-family:'DM Sans';padding:72px;box-sizing:border-box;">` +
    `<div style="display:flex;flex-direction:column;justify-content:space-between;flex:1;padding-right:56px;">` +
    `<div style="display:flex;color:#B04A1C;font-size:26px;font-weight:500;letter-spacing:2px;">FOXING</div>` +
    `<div style="display:flex;flex-direction:column;">` +
    `<div style="display:flex;font-family:'${titleFamily}';font-size:${title.length > 40 ? 56 : 70}px;font-weight:600;color:#16100B;line-height:1.05;">${title}</div>` +
    `<div style="display:flex;margin-top:28px;font-size:34px;color:#3E3028;">by ${author}</div>` +
    `</div>` +
    `<div style="display:flex;align-items:center;font-size:24px;color:#815E41;"><div style="display:flex;width:44px;height:4px;background:#D4622E;margin-right:16px;"></div>Read the classics, free</div>` +
    `</div>` +
    coverBlock +
    `</div>`;

  const fonts = [
    display
      ? { name: "Fraunces", data: display, weight: 600 as const, style: "normal" as const }
      : null,
    ui ? { name: "DM Sans", data: ui, weight: 500 as const, style: "normal" as const } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    const image = new ImageResponse(html, { width: WIDTH, height: HEIGHT, fonts });
    // Materialize the PNG so any render error is caught here (satori/resvg run async).
    const png = await new Response(image.body).arrayBuffer();
    const response = new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=0, s-maxage=604800, immutable",
      },
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    // Render failed: fall back to the cover (or home) so crawlers still get an image.
    return Response.redirect(book.coverUrl ?? SITE_ORIGIN, 302);
  }
}
