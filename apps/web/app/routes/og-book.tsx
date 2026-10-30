import { toBase64 } from "@dustinedwards/site-runtime/encoding";
import { cardText } from "@dustinedwards/site-runtime/share-card";
import { catalogRepo } from "@foxing/core";
import { coverSrc } from "~/lib/images";
import { loaderBase } from "~/lib/loader.server";
import { ogCard } from "~/lib/og.server";
import type { Route } from "./+types/og-book";
import { OG_CACHE_ORIGIN, SITE_ORIGIN } from "~/lib/origins";

async function coverDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(coverSrc(url, 480));
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${toBase64(await res.arrayBuffer())}`;
  } catch {
    return null;
  }
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const book = await catalogRepo.getBookBySlug(db, params.slug);
  if (!book) throw new Response("Not found", { status: 404 });

  const cardRequest = new Request(
    `${OG_CACHE_ORIGIN}/book/${book.slug}?v=${book.updatedAt?.getTime() ?? 0}`,
  );
  // The card, or when it cannot be drawn (no font, a render error), the cover (or home), so
  // crawlers still get art. The cover is fetched only on a cache miss.
  const card = await ogCard(cardRequest, async ({ titleFamily }) => {
    const cover = book.coverUrl ? await coverDataUri(book.coverUrl) : null;
    const title = cardText(book.title.length > 80 ? `${book.title.slice(0, 77)}...` : book.title);
    const author = cardText(book.author);

    // Single line, no whitespace between tags: satori counts whitespace text nodes as
    // children and requires display:flex on any multi-child element.
    const coverBlock = cover
      ? `<div style="display:flex;width:340px;height:100%;align-items:center;"><img src="${cover}" width="340" height="510" style="border-radius:10px;object-fit:cover;box-shadow:0 20px 45px rgba(22,16,11,0.28);"/></div>`
      : "";
    return (
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
      `</div>`
    );
  });

  return card.status === 503 ? Response.redirect(book.coverUrl ?? SITE_ORIGIN, 302) : card;
}
