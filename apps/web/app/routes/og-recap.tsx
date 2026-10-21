import { escapeHtml } from "@dustinedwards/site-runtime/html";
// OG image for a Year in Reading recap at /og/recap/:username/:year. Mirrors og-book's
// satori pipeline (legacy-UA WOFF font load, edge cache, PNG materialize with a graceful
// fallback). Only public profiles render; others 404 (crawlers get nothing to leak).
import { ImageResponse } from "workers-og";
import { edgeCache } from "~/lib/cache.server";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { loadRecap } from "~/lib/social.server";
import type { Route } from "./+types/og-recap";

const WIDTH = 1200;
const HEIGHT = 630;

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `https://fontcache.foxing.app/${family}-${weight}.font`;
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
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    await cache.put(
      key,
      new Response(buf, { headers: { "Cache-Control": "public, max-age=31536000" } }),
    );
    return buf;
  } catch {
    return null;
  }
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const year = Number(params.year);
  if (!Number.isInteger(year)) throw new Response("Not found", { status: 404 });
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  const data = await loadRecap(env, { username: params.username }, year, session?.user?.id ?? null);
  if (!data) throw new Response("Not found", { status: 404 });

  const cacheKey = new Request(
    `https://og.foxing.app/recap/${params.username}/${year}?b=${data.recap.booksFinished}`,
  );
  const cache = edgeCache();
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [display, ui] = await Promise.all([loadFont("Fraunces", 600), loadFont("DM Sans", 500)]);
  if (!display && !ui) return Response.redirect("https://foxing.app", 302);

  const name = escapeHtml(data.displayName);
  const top = data.recap.topBooks.slice(0, 3).map((b) => escapeHtml(b.title));
  const titleFamily = display ? "Fraunces" : "DM Sans";
  const topBlock = top
    .map(
      (t) =>
        `<div style="display:flex;font-size:30px;color:#3E3028;margin-top:10px;"><div style="display:flex;width:30px;height:3px;background:#D4622E;margin-right:16px;align-self:center;"></div>${t}</div>`,
    )
    .join("");

  const html =
    `<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#FAF6EE;font-family:'DM Sans';padding:72px;box-sizing:border-box;justify-content:space-between;">` +
    `<div style="display:flex;color:#B04A1C;font-size:26px;font-weight:500;letter-spacing:2px;">FOXING - YEAR IN READING ${year}</div>` +
    `<div style="display:flex;flex-direction:column;">` +
    `<div style="display:flex;font-family:'${titleFamily}';font-size:64px;font-weight:600;color:#16100B;line-height:1.05;">${name} read ${data.recap.booksFinished} books</div>` +
    `<div style="display:flex;flex-direction:column;margin-top:28px;">${topBlock}</div>` +
    `</div>` +
    `<div style="display:flex;align-items:center;font-size:24px;color:#815E41;"><div style="display:flex;width:44px;height:4px;background:#D4622E;margin-right:16px;"></div>foxing.app</div>` +
    `</div>`;

  const fonts = [
    display
      ? { name: "Fraunces", data: display, weight: 600 as const, style: "normal" as const }
      : null,
    ui ? { name: "DM Sans", data: ui, weight: 500 as const, style: "normal" as const } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  try {
    const image = new ImageResponse(html, { width: WIDTH, height: HEIGHT, fonts });
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
    return Response.redirect("https://foxing.app", 302);
  }
}
