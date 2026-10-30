import { cardText } from "@dustinedwards/site-runtime/share-card";
// OG image for a Year in Reading recap at /og/recap/:username/:year, through the same
// pipeline as og-book (lib/og.server). Only public profiles render; others 404
// (crawlers get nothing to leak).
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { ogCard } from "~/lib/og.server";
import { createDb, views } from "@foxing/core";
import type { Route } from "./+types/og-recap";
import { OG_CACHE_ORIGIN, SITE_ORIGIN } from "~/lib/origins";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const year = Number(params.year);
  if (!Number.isInteger(year)) throw new Response("Not found", { status: 404 });
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  const data = await views.recap(
    createDb(env.DB),
    { username: params.username },
    year,
    session?.user?.id ?? null,
  );
  if (!data) throw new Response("Not found", { status: 404 });

  const cardKey = new Request(
    `${OG_CACHE_ORIGIN}/recap/${params.username}/${year}?b=${data.recap.booksFinished}`,
  );
  const name = cardText(data.displayName);
  const top = data.recap.topBooks.slice(0, 3).map((b) => cardText(b.title));
  const topBlock = top
    .map(
      (t) =>
        `<div style="display:flex;font-size:30px;color:#3E3028;margin-top:10px;"><div style="display:flex;width:30px;height:3px;background:#D4622E;margin-right:16px;align-self:center;"></div>${t}</div>`,
    )
    .join("");

  // The card, or home when it cannot be drawn (no font, a render error).
  const card = await ogCard(
    cardKey,
    ({ titleFamily }) =>
      `<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#FAF6EE;font-family:'DM Sans';padding:72px;box-sizing:border-box;justify-content:space-between;">` +
      `<div style="display:flex;color:#B04A1C;font-size:26px;font-weight:500;letter-spacing:2px;">FOXING - YEAR IN READING ${year}</div>` +
      `<div style="display:flex;flex-direction:column;">` +
      `<div style="display:flex;font-family:'${titleFamily}';font-size:64px;font-weight:600;color:#16100B;line-height:1.05;">${name} read ${data.recap.booksFinished} books</div>` +
      `<div style="display:flex;flex-direction:column;margin-top:28px;">${topBlock}</div>` +
      `</div>` +
      `<div style="display:flex;align-items:center;font-size:24px;color:#815E41;"><div style="display:flex;width:44px;height:4px;background:#D4622E;margin-right:16px;"></div>foxing.app</div>` +
      `</div>`,
  );
  return card.status === 503 ? Response.redirect(SITE_ORIGIN, 302) : card;
}
