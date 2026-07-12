// Shared EPUB -> Readium Web Publication explosion. Turns a raw .epub buffer
// into an RWPM manifest.json, its resource files, and a Readium position list
// (application/vnd.readium.position-list+json) so the web reader gets an
// accurate scrubber and positionsFromManifest() returns real positions.
//
// The manifest links the position list (rel "position-list") and hrefs are
// the archive-relative paths, resolved by the navigator against the manifest's
// self link. Mirrors the throwaway spike explode, hardened for the batch run.
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { posix } from "node:path";

export interface RwpmLink {
  href: string;
  type: string;
  rel?: string[];
  title?: string;
}

export interface RwpmManifest {
  "@context": string;
  metadata: { "@type": string; title: string; language: string; identifier: string };
  links: RwpmLink[];
  readingOrder: RwpmLink[];
  resources: RwpmLink[];
  toc: { href: string; title: string }[];
}

export interface PositionList {
  total: number;
  positions: Array<{
    href: string;
    type: string;
    title?: string;
    locations: { position: number; progression: number; totalProgression: number };
  }>;
}

export interface ExplodeResult {
  manifest: RwpmManifest;
  positionList: PositionList;
  files: Map<string, Buffer>; // archive-relative path -> bytes (excludes mimetype)
  stats: { readingOrder: number; resources: number; toc: number; positions: number };
}

const CHARS_PER_POSITION = 1500;

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["item", "itemref", "navPoint", "rootfile"].includes(name),
});

function textNode(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return undefined;
}

function resolveFromOpf(opfPath: string, href: string): string {
  const opfDir = posix.dirname(opfPath);
  const clean = decodeURIComponent(href.split("#")[0]);
  return posix.normalize(posix.join(opfDir, clean));
}

function stripToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function explodeEpub(buf: Buffer): Promise<ExplodeResult> {
  const zip = await JSZip.loadAsync(buf);

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("missing META-INF/container.xml");
  const container = xml.parse(await containerFile.async("string"));
  const rootfiles = container?.container?.rootfiles?.rootfile;
  const opfPath = (Array.isArray(rootfiles) ? rootfiles[0] : rootfiles)?.["@_full-path"];
  if (!opfPath) throw new Error("no rootfile full-path in container.xml");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`OPF not found: ${opfPath}`);
  const opf = xml.parse(await opfFile.async("string"));
  const pkg = opf.package;
  const meta = pkg.metadata;
  const manifestItems = pkg.manifest.item as Array<Record<string, string>>;
  const spineRefs = pkg.spine.itemref as Array<Record<string, string>>;
  const byId = new Map(manifestItems.map((it) => [it["@_id"], it]));

  const title = textNode(meta["dc:title"]) ?? "Untitled";
  const language = textNode(meta["dc:language"]) ?? "en";
  const identifier = textNode(meta["dc:identifier"]) ?? opfPath;

  // readingOrder from spine (skip linear="no")
  const readingOrder: RwpmLink[] = [];
  for (const ref of spineRefs) {
    if (ref["@_linear"] === "no") continue;
    const item = byId.get(ref["@_idref"]);
    if (!item) continue;
    readingOrder.push({
      href: resolveFromOpf(opfPath, item["@_href"]),
      type: item["@_media-type"],
    });
  }
  if (readingOrder.length === 0) throw new Error("empty reading order");

  const spineIds = new Set(spineRefs.map((r) => r["@_idref"]));
  const resources: RwpmLink[] = [];
  let navHref: string | null = null;
  let ncxHref: string | null = null;
  for (const item of manifestItems) {
    const href = resolveFromOpf(opfPath, item["@_href"]);
    const props = (item["@_properties"] ?? "").split(/\s+/);
    if (props.includes("nav")) navHref = href;
    if (item["@_media-type"] === "application/x-dtbncx+xml") ncxHref = href;
    if (spineIds.has(item["@_id"])) continue;
    const entry: RwpmLink = { href, type: item["@_media-type"] };
    if (props.includes("cover-image")) entry.rel = ["cover"];
    resources.push(entry);
  }

  // toc: EPUB3 nav -> NCX -> reading order
  let toc: { href: string; title: string }[] = [];
  if (navHref) toc = await tocFromNav(zip, navHref);
  if (toc.length === 0 && ncxHref) toc = await tocFromNcx(zip, ncxHref);
  if (toc.length === 0) {
    toc = readingOrder.map((r, i) => ({ href: r.href, title: `Section ${i + 1}` }));
  }

  // Emit every entry except mimetype (added by wrappers) and the OPF itself is
  // kept (harmless). Files keyed by archive path; manifest hrefs match.
  const files = new Map<string, Buffer>();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || entry.name === "mimetype") continue;
    files.set(entry.name, await entry.async("nodebuffer"));
  }

  // Position list: distribute positions across reading order by stripped-text
  // length (min 1 per resource). totalProgression spans 0..1 across the book.
  const lengths: number[] = [];
  for (const r of readingOrder) {
    const raw = files.get(r.href);
    const chars = raw ? stripToText(raw.toString("utf-8")).length : 0;
    lengths.push(Math.max(1, Math.ceil(chars / CHARS_PER_POSITION)));
  }
  const totalPositions = lengths.reduce((a, b) => a + b, 0);
  const positions: PositionList["positions"] = [];
  let pos = 0;
  for (let ri = 0; ri < readingOrder.length; ri++) {
    const count = lengths[ri];
    for (let k = 0; k < count; k++) {
      pos++;
      positions.push({
        href: readingOrder[ri].href,
        type: readingOrder[ri].type,
        locations: {
          position: pos,
          progression: count > 1 ? k / count : 0,
          totalProgression: totalPositions > 1 ? (pos - 1) / (totalPositions - 1) : 0,
        },
      });
    }
  }
  const positionList: PositionList = { total: positions.length, positions };

  const manifest: RwpmManifest = {
    "@context": "https://readium.org/webpub-manifest/context.jsonld",
    metadata: { "@type": "http://schema.org/Book", title, language, identifier },
    links: [
      { rel: ["self"], href: "manifest.json", type: "application/webpub+json" },
      {
        rel: ["position-list"],
        href: "position-list.json",
        type: "application/vnd.readium.position-list+json",
      },
    ],
    readingOrder,
    resources,
    toc,
  };

  return {
    manifest,
    positionList,
    files,
    stats: {
      readingOrder: readingOrder.length,
      resources: resources.length,
      toc: toc.length,
      positions: positions.length,
    },
  };
}

async function tocFromNav(zip: JSZip, navHref: string): Promise<{ href: string; title: string }[]> {
  const f = zip.file(navHref);
  if (!f) return [];
  const navXml = await f.async("string");
  const navDir = posix.dirname(navHref);
  const tocMatch = navXml.match(
    /<nav[^>]*epub:type="[^"]*\btoc\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/i,
  );
  const scope = tocMatch ? tocMatch[1] : navXml;
  const re = /<a[^>]*href="([^"#]+)(?:#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;
  const out: { href: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = re.exec(scope)) !== null) {
    const href = posix.normalize(posix.join(navDir, decodeURIComponent(m[1])));
    const label = m[2].replace(/<[^>]+>/g, "").trim();
    if (label) out.push({ href, title: label });
  }
  return out;
}

async function tocFromNcx(zip: JSZip, ncxHref: string): Promise<{ href: string; title: string }[]> {
  const f = zip.file(ncxHref);
  if (!f) return [];
  const ncxDir = posix.dirname(ncxHref);
  const parsed = xml.parse(await f.async("string"));
  const points = parsed?.ncx?.navMap?.navPoint ?? [];
  const out: { href: string; title: string }[] = [];
  for (const p of points) {
    const label = textNode(p?.navLabel?.text);
    const src = p?.content?.["@_src"];
    if (!label || !src) continue;
    const href = posix.normalize(posix.join(ncxDir, decodeURIComponent(String(src).split("#")[0])));
    out.push({ href, title: label });
  }
  return out;
}
