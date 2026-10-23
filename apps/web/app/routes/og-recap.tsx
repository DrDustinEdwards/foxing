import { escapeHtml } from "@dustinedwards/site-runtime/html";
// OG image for a Year in Reading recap at /og/recap/:username/:year, through the same
// pipeline as og-book (lib/og.server). Only public profiles render; others 404
// (crawlers get nothing to leak).
import { edgeCache } from "~/lib/cache.server";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { loadOgFonts, renderOgPng } from "~/lib/og.server";
import { loadRecap } from "~/lib/social.server";
import type { Route } from "./+types/og-recap";
import { OG_CACHE_ORIGIN, SITE_ORIGIN } from "~/lib/origins";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const year = Number(params.year);
  if (!Number.isInteger(year)) throw new Response("Not found", { status: 404 });
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  const data = await loadRecap(env, { username: params.username }, year, session?.user?.id ?? null);
  if (!data) throw new Response("Not found", { status: 404 });

  const cacheKey = new Request(
    `${OG_CACHE_ORIGIN}/recap/${params.username}/${year}?b=${data.recap.booksFinished}`,
  );
  const cache = edgeCache();
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const fonts = await loadOgFonts();
  const [display, ui] = fonts;
  if (!display && !ui) return Response.redirect(SITE_ORIGIN, 302);

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

  return (await renderOgPng(html, fonts, cacheKey)) ?? Response.redirect(SITE_ORIGIN, 302);
}
