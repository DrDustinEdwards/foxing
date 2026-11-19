// Cleans one XHTML or SVG file from a book, once, when the book is added. The reader shows a
// book's files in a frame on the app's own origin, so what a file can run must be settled before
// it is stored: the page's Content-Security-Policy is the second layer, not the only one.
//
// Removed: script, iframe, frame, frameset, object, embed, applet, base, form, meta refresh,
// and SVG animate and set (they can rewrite an href after the check). Every on* attribute,
// srcdoc, action and formaction go too, and any link or source whose scheme is not http, https,
// mailto, tel, a data: image (not SVG), or none at all (a relative link or a fragment).
// The file is rewritten token by token; attribute and text bytes pass through as written.
import { Parser } from "htmlparser2";
import { decodeHTML } from "entities";

const DROP_ELEMENTS = new Set([
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "base",
  "form",
  "animate",
  "set",
]);
const DROP_ATTRIBUTES = new Set(["srcdoc", "action", "formaction", "ping"]);
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const SAFE_DATA = /^data:image\/(?:png|jpe?g|gif|webp|avif);/i;

function localName(name: string): string {
  return name.slice(name.lastIndexOf(":") + 1).toLowerCase();
}

function urlAllowed(raw: string): boolean {
  // eslint-disable-next-line no-control-regex
  const value = decodeHTML(raw).replace(/[\u0000- \u007f-\u009f�]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme) return true;
  const name = scheme[1].toLowerCase();
  return SAFE_SCHEMES.has(name) || (name === "data" && SAFE_DATA.test(value));
}

function attributeAllowed(name: string, value: string): boolean {
  const local = localName(name);
  if (local.startsWith("on") || DROP_ATTRIBUTES.has(local)) return false;
  if (local === "href" || local === "src" || local === "poster" || local === "data") {
    return urlAllowed(value);
  }
  return true;
}

export function cleanBookMarkup(source: string): string {
  const out: string[] = [];
  let skipDepth = 0;
  let pending: string | null = null; // an open tag not yet written, so <br/> stays self-closing
  let inCdata = false;

  const flush = () => {
    if (pending !== null) {
      out.push(pending, ">");
      pending = null;
    }
  };

  const parser = new Parser(
    {
      onprocessinginstruction(_name, data) {
        if (skipDepth) return;
        flush();
        // htmlparser2 hands over `?xml version="1.0"?` without its closing "?"; a declaration without it is not
        // XML, and the reader's DOMParser refuses the whole page.
        out.push("<", data.startsWith("?") && !data.endsWith("?") ? `${data}?` : data, ">");
      },
      onopentag(name, attrs) {
        if (skipDepth) {
          skipDepth++;
          return;
        }
        const local = localName(name);
        const refresh =
          local === "meta" &&
          /refresh/i.test(`${attrs["http-equiv"] ?? ""}${attrs["content"] ?? ""}`);
        if (DROP_ELEMENTS.has(local) || refresh) {
          skipDepth = 1;
          return;
        }
        flush();
        let tag = `<${name}`;
        for (const [key, value] of Object.entries(attrs)) {
          if (attributeAllowed(key, value)) tag += ` ${key}="${value.replaceAll('"', "&quot;")}"`;
        }
        pending = tag;
      },
      onclosetag(name, selfClosed) {
        if (skipDepth) {
          skipDepth--;
          return;
        }
        if (pending !== null && selfClosed) {
          out.push(pending, "/>");
          pending = null;
        } else {
          flush();
          out.push("</", name, ">");
        }
      },
      oncdatastart() {
        if (skipDepth) return;
        flush();
        inCdata = true;
        out.push("<![CDATA[");
      },
      oncdataend() {
        if (!inCdata) return;
        inCdata = false;
        out.push("]]>");
      },
      ontext(text) {
        if (skipDepth) return;
        flush();
        out.push(text);
      },
      oncomment(text) {
        if (skipDepth) return;
        flush();
        out.push("<!--", text, "-->");
      },
    },
    { xmlMode: true, decodeEntities: false, recognizeSelfClosing: true },
  );
  parser.end(source);
  flush();
  return out.join("");
}
