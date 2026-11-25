// Extracts chapter text from the EPUB in JS, since Readium exposes none: jszip opens the archive once per URL (cached) and chapter HTML is tag-stripped.

import JSZip from "jszip";
import * as FileSystem from "expo-file-system/legacy";

import { ensureEpubLocalUri } from "@/lib/epub-cache";

interface SpineItem {
  href: string;
  mediaType: string;
}

interface OpenedEpub {
  zip: JSZip;
  // Absolute zip paths in spine order, to resolve relative chapter hrefs.
  spine: SpineItem[];
  // OPF directory; manifest hrefs are relative to it, not the zip root.
  rootDir: string;
}

const openCache = new Map<string, Promise<OpenedEpub>>();

async function readFileAsArrayBuffer(path: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToArrayBuffer(base64);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob ? globalThis.atob(base64) : decodeBase64Fallback(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function decodeBase64Fallback(input: string): string {
  // Fallback for environments without atob (unit tests).
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const cleaned = input.replace(/[^A-Za-z0-9+/=]/g, "");
  let out = "";
  for (let i = 0; i < cleaned.length;) {
    const c1 = chars.indexOf(cleaned.charAt(i++));
    const c2 = chars.indexOf(cleaned.charAt(i++));
    const c3 = chars.indexOf(cleaned.charAt(i++));
    const c4 = chars.indexOf(cleaned.charAt(i++));
    out += String.fromCharCode((c1 << 2) | (c2 >> 4));
    if (c3 !== 64) out += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2));
    if (c4 !== 64) out += String.fromCharCode(((c3 & 3) << 6) | c4);
  }
  return out;
}

// container.xml's <rootfile> is the canonical OPF pointer; the path varies by publisher.
async function findOpfPath(zip: JSZip): Promise<string> {
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("container.xml not found");
  const containerXml = await containerFile.async("text");
  const match = /<rootfile[^>]+full-path="([^"]+)"/i.exec(containerXml);
  if (!match) throw new Error("rootfile path missing from container.xml");
  return match[1];
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i + 1) : "";
}

function resolveRelative(rootDir: string, ref: string): string {
  if (ref.startsWith("/")) return ref.slice(1);
  const cleaned = ref.split("#")[0];
  return `${rootDir}${cleaned}`;
}

function parseOpf(rootDir: string, opfXml: string): SpineItem[] {
  const manifest = new Map<string, { href: string; mediaType: string }>();
  const itemRegex = /<item\s+([^>]+?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(opfXml)) !== null) {
    const attrs = m[1];
    const id = /id="([^"]+)"/i.exec(attrs)?.[1];
    const href = /href="([^"]+)"/i.exec(attrs)?.[1];
    const mt = /media-type="([^"]+)"/i.exec(attrs)?.[1] ?? "";
    if (id && href) manifest.set(id, { href: resolveRelative(rootDir, href), mediaType: mt });
  }

  const spine: SpineItem[] = [];
  const itemrefRegex = /<itemref\s+([^>]+?)\/?>/gi;
  while ((m = itemrefRegex.exec(opfXml)) !== null) {
    const idref = /idref="([^"]+)"/i.exec(m[1])?.[1];
    if (!idref) continue;
    const item = manifest.get(idref);
    if (item) spine.push(item);
  }
  return spine;
}

async function openEpub(remoteUrl: string): Promise<OpenedEpub> {
  const cached = openCache.get(remoteUrl);
  if (cached) return cached;
  const promise = (async (): Promise<OpenedEpub> => {
    const path = await ensureEpubLocalUri(remoteUrl);
    const buf = await readFileAsArrayBuffer(path);
    const zip = await JSZip.loadAsync(buf);
    const opfPath = await findOpfPath(zip);
    const rootDir = dirname(opfPath);
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error(`OPF not found at ${opfPath}`);
    const opfXml = await opfFile.async("text");
    const spine = parseOpf(rootDir, opfXml);
    return { zip, spine, rootDir };
  })();
  openCache.set(remoteUrl, promise);
  promise.catch(() => openCache.delete(remoteUrl));
  return promise;
}

// Block-level elements end with a newline so paragraph boundaries survive for the sentence splitter.
function epubHtmlToText(html: string): string {
  const noScript = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const withBreaks = noScript
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr|br)>/gi, "$&\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeEntities(stripped)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, ent: string) => {
    if (ent.startsWith("#")) {
      const hex = ent[1] === "x" || ent[1] === "X";
      const code = parseInt(ent.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? `&${ent};`;
  });
}

function resolveChapterPath(opened: OpenedEpub, hrefOrPath: string): string | null {
  const cleaned = hrefOrPath.split("#")[0];
  if (!cleaned) return null;
  for (const item of opened.spine) {
    if (item.href === cleaned) return item.href;
    if (item.href.endsWith(`/${cleaned}`)) return item.href;
    if (cleaned.endsWith(`/${item.href}`)) return item.href;
  }
  if (opened.zip.file(cleaned)) return cleaned;
  return null;
}

export interface ChapterContent {
  text: string;
}

export async function getChapterContent(
  remoteUrl: string,
  chapterHrefOrLocator: string,
): Promise<ChapterContent> {
  const opened = await openEpub(remoteUrl);
  const path = resolveChapterPath(opened, chapterHrefOrLocator);
  if (!path) return { text: "" };
  const file = opened.zip.file(path);
  if (!file) return { text: "" };
  const html = await file.async("text");
  return {
    text: epubHtmlToText(html),
  };
}
