// The site-wide share card: what a page without a book or post card of its own shows when
// shared. The same layout, fonts and colors as og-book, without the cover.
import { ogCard } from "~/lib/og.server";
import { OG_CACHE_ORIGIN } from "~/lib/origins";

// Bump when the card's HTML changes, so the edge cache serves the new one.
const VERSION = 1;

export function loader() {
  // Single line, no whitespace between tags: satori counts whitespace text nodes as
  // children and requires display:flex on any multi-child element.
  return ogCard(
    new Request(`${OG_CACHE_ORIGIN}/site?v=${VERSION}`),
    ({ titleFamily }) =>
      `<div style="display:flex;width:100%;height:100%;background:#FAF6EE;font-family:'DM Sans';padding:72px;box-sizing:border-box;">` +
      `<div style="display:flex;flex-direction:column;justify-content:space-between;flex:1;">` +
      `<div style="display:flex;color:#B04A1C;font-size:26px;font-weight:500;letter-spacing:2px;">FOXING</div>` +
      `<div style="display:flex;flex-direction:column;">` +
      `<div style="display:flex;flex-direction:column;font-family:'${titleFamily}';font-size:92px;font-weight:600;color:#16100B;line-height:1.02;"><div style="display:flex;">Read the classics,</div><div style="display:flex;">free.</div></div>` +
      `<div style="display:flex;margin-top:30px;font-size:34px;color:#3E3028;">Public-domain books, a reader, and your shelves.</div>` +
      `</div>` +
      `<div style="display:flex;align-items:center;font-size:24px;color:#815E41;"><div style="display:flex;width:44px;height:4px;background:#D4622E;margin-right:16px;"></div>foxing.app</div>` +
      `</div>` +
      `</div>`,
  );
}
