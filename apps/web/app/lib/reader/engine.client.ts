// Client-only Readium ts-toolkit wiring, imported dynamically from an effect so none of it evaluates during SSR.
import { HttpFetcher, Locator as ReadiumLocator, Manifest, Publication } from "@readium/shared";
import {
  EpubNavigator,
  type EpubNavigatorListeners,
  type IInjectableRule,
} from "@readium/navigator";
import type { HighlightColor } from "@foxing/core";
import {
  allowDocumentParsing,
  installTrustedTypes,
} from "@dustinedwards/site-runtime/trusted-types";
import {
  decorationStyleFor,
  noteOutlineStyleFor,
  otherDecorationStyleFor,
  popularDecorationStyleFor,
} from "./locator";
import type { Locator, SelectionContext } from "./locator";
import type { ReaderSettings, ReaderTheme } from "./settings";
import { initialEpubPreferences, toEpubPreferences } from "./settings";

const CONTEXT_CHARS = 40;
const ANNOTATION_GROUP = "annotations";
// A second group, drawn but never registered for activation, carrying the "has a note" outline, so the ANNOTATION_GROUP
// fill is the sole click target and a tap resolves to one annotation.
const NOTE_GROUP = "annotation-notes";
// The popular-highlights ambient underline: its own non-active group so it never competes for a click.
const POPULAR_GROUP = "popular-highlights";

export interface DecorationRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HighlightSpec {
  id: string;
  locator: Locator;
  color: HighlightColor;
  hasNote: boolean;
  ownership: "mine" | "other";
}

interface PopularSpec {
  id: string;
  locator: Locator;
}

export interface SelectionPayload {
  text: string;
  locator: Locator;
  context: SelectionContext;
  rect: { x: number; y: number; width: number; height: number } | null;
}

interface EngineListeners {
  onPosition: (locator: Locator) => void;
  onSelection: (payload: SelectionPayload) => void;
  onDecorationActivated: (id: string, rect: DecorationRect | null) => void;
  onReady: () => void;
}

export interface CreateEngineOptions {
  container: HTMLElement;
  manifestUrl: string;
  initialLocator: Locator | null;
  settings: ReaderSettings;
  listeners: EngineListeners;
}

export interface TocEntry {
  href: string;
  title: string;
}

export interface ReaderEngine {
  toc: TocEntry[];
  next: () => void;
  prev: () => void;
  goToHref: (href: string) => void;
  goToLocator: (locator: Locator) => void;
  goToTotalProgression: (fraction: number) => void;
  applyHighlights: (specs: HighlightSpec[], theme: ReaderTheme) => void;
  applyPopular: (specs: PopularSpec[], theme: ReaderTheme) => void;
  applySettings: (settings: ReaderSettings) => Promise<void>;
  currentLocator: () => Locator | null;
  destroy: () => Promise<void>;
}

/**
 * The reader page's CSP nonce (workers/security-headers.ts). Readium loads its helper scripts into blob: frames that
 * inherit the page's policy, which allows no blob: script, so each is given this nonce; an EPUB's inline scripts never
 * carry it. The browser hides the nonce attribute but keeps the `nonce` property, which is read here.
 */
function pageNonce(): string | undefined {
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || undefined;
}

/**
 * Puts the nonce on Readium's built-in script injectables before the first frame is built. They are not configurable, so
 * this reaches `_readiumRulesPromise` (@readium/navigator 2.6); a Readium rename is logged and fails the e2e reader spec.
 */
async function nonceReadiumInjectables(nav: EpubNavigator): Promise<void> {
  const nonce = pageNonce();
  if (!nonce) return;
  const rulesPromise = (nav as unknown as { _readiumRulesPromise?: Promise<IInjectableRule[]> })
    ._readiumRulesPromise;
  if (!rulesPromise) {
    console.error(
      "[reader] Readium's built-in injectables were not found; frame scripts will be blocked by the CSP",
    );
    return;
  }
  for (const rule of await rulesPromise) {
    for (const injectable of [...(rule.prepend ?? []), ...(rule.append ?? [])]) {
      if (injectable.as === "script") injectable.attributes = { ...injectable.attributes, nonce };
    }
  }
}

/** The one markup Readium writes inside a book frame (@readium/navigator-html-injectables 2.5), matched whole so nothing else rides along. */
const READIUM_DECORATION =
  /^<div data-readium="true" class="readium-[\w-]+" style="[^"<>]*"><\/div>$/;

const FRAME_POLICY_KEY = "foxing:reader-frame-policy";

/**
 * The script Readium puts first in every book frame so it has a Trusted Types default policy before Readium's frame code
 * runs: a blob: frame inherits the page's CSP (require-trusted-types-for) but not its policies, and would refuse Readium's
 * highlight styles and decoration boxes. Carries the page's nonce, like Readium's own frame scripts.
 */
function readerFramePolicy(nonce: string | undefined): IInjectableRule {
  const page = window as unknown as Record<string, (frame: Window) => void>;
  page[FRAME_POLICY_KEY] = (frame) => {
    installTrustedTypes({ target: frame, allowHtml: (html) => READIUM_DECORATION.test(html) });
  };
  const source = `window.parent[${JSON.stringify(FRAME_POLICY_KEY)}]?.(window);`;
  return {
    resources: [/.*/],
    prepend: [
      {
        id: "foxing-trusted-types",
        as: "script",
        target: "head",
        blob: new Blob([source], { type: "text/javascript" }),
        ...(nonce ? { attributes: { nonce } } : {}),
      },
    ],
  };
}

function serialize(loc: unknown): Locator {
  const anyLoc = loc as { serialize?: () => Locator };
  return anyLoc?.serialize ? anyLoc.serialize() : (loc as Locator);
}

// Content frames are same-origin blob iframes, so the parent can read their live selection.
function readSelectionContext(
  container: HTMLElement,
): (SelectionContext & { exact: string }) | null {
  const iframes = Array.from(container.querySelectorAll("iframe"));
  for (const iframe of iframes) {
    const win = iframe.contentWindow as
      | (Window & { _readium_cssSelectorGenerator?: unknown })
      | null;
    const sel = win?.getSelection?.();
    if (!win || !sel || sel.rangeCount === 0 || sel.isCollapsed) continue;
    const exact = sel.toString();
    if (!exact.trim()) continue;

    const range = sel.getRangeAt(0);
    const doc = win.document;
    const blockTags = new Set([
      "P",
      "DIV",
      "LI",
      "BLOCKQUOTE",
      "SECTION",
      "TD",
      "H1",
      "H2",
      "H3",
      "H4",
    ]);
    let rootEl: Element | null =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
    while (rootEl && !blockTags.has(rootEl.tagName) && rootEl.parentElement) {
      rootEl = rootEl.parentElement;
    }
    const root = rootEl ?? doc.body;
    const rootText = root.textContent ?? "";

    const startProbe = doc.createRange();
    startProbe.selectNodeContents(root);
    startProbe.setEnd(range.startContainer, range.startOffset);
    const startOffset = startProbe.toString().length;
    const endOffset = startOffset + exact.length;

    const before = rootText.slice(Math.max(0, startOffset - CONTEXT_CHARS), startOffset);
    const after = rootText.slice(endOffset, endOffset + CONTEXT_CHARS);

    let cssSelector: string | undefined;
    const gen = win._readium_cssSelectorGenerator as
      | { getCssSelector?: (el: Element, opts: unknown) => string }
      | undefined;
    if (gen?.getCssSelector) {
      try {
        cssSelector = gen.getCssSelector(root, {
          selectors: ["id", "class", "tag", "nthchild", "nthoftype"],
        });
      } catch {
        cssSelector = undefined;
      }
    }
    return { exact, before, after, cssSelector };
  }
  return null;
}

/**
 * Opens the reader. Readium parses each chapter into an inert document and loads it into a blob: frame; the page's Trusted
 * Types default policy escapes markup at that sink unless the page holds allowDocumentParsing(), held until destroy().
 */
export async function createEngine(opts: CreateEngineOptions): Promise<ReaderEngine> {
  const releaseParsing = allowDocumentParsing();
  try {
    const engine = await openEngine(opts);
    return {
      ...engine,
      destroy: async () => {
        await engine.destroy();
        releaseParsing();
      },
    };
  } catch (error) {
    releaseParsing();
    throw error;
  }
}

async function openEngine(opts: CreateEngineOptions): Promise<ReaderEngine> {
  const { container, manifestUrl, initialLocator, settings, listeners } = opts;

  const manifestJson = await (await fetch(manifestUrl)).json();
  const manifest = Manifest.deserialize(manifestJson);
  if (!manifest) throw new Error("invalid manifest");
  manifest.setSelfLink(manifestUrl);

  const fetcher = new HttpFetcher(window.fetch.bind(window), manifest.baseURL);
  const pub = new Publication({ manifest, fetcher });

  let positions = await pub.positionsFromManifest();
  if (positions.length === 0) {
    const items = manifest.readingOrder.items;
    positions = items
      .map((l, i) =>
        ReadiumLocator.deserialize({
          href: l.href,
          type: l.type ?? "application/xhtml+xml",
          locations: {
            position: i + 1,
            totalProgression: items.length > 1 ? i / (items.length - 1) : 0,
            progression: 0,
          },
        }),
      )
      .filter((l): l is ReadiumLocator => l !== undefined);
  }

  const initial = initialLocator
    ? (ReadiumLocator.deserialize(initialLocator) ?? positions[0])
    : positions[0];

  const navListeners: EpubNavigatorListeners = {
    frameLoaded: () => {},
    positionChanged: (loc) => listeners.onPosition(serialize(loc)),
    viewportChanged: () => {},
    timelineItemChanged: () => {},
    tap: () => false,
    click: () => false,
    zoom: () => {},
    miscPointer: () => {},
    scroll: () => {},
    customEvent: () => {},
    handleLocator: () => false,
    textSelected: (sel) => {
      const base = sel.locator ? serialize(sel.locator) : null;
      if (!base) return;
      const ctx = readSelectionContext(container);
      listeners.onSelection({
        text: sel.text,
        locator: base,
        context: ctx ? { before: ctx.before, after: ctx.after, cssSelector: ctx.cssSelector } : {},
        rect: { x: sel.x, y: sel.y, width: sel.width, height: sel.height },
      });
    },
    contentProtection: () => {},
    contextMenu: () => {},
    peripheral: () => {},
  };

  const nav = new EpubNavigator(container, pub, navListeners, positions, initial, {
    preferences: initialEpubPreferences(settings),
    defaults: {},
    injectables: { rules: [readerFramePolicy(pageNonce())], allowedDomains: [] },
  } as never);
  await nonceReadiumInjectables(nav);
  await nav.load();

  nav.registerDecorationObserver(ANNOTATION_GROUP, {
    onDecorationActivated: (event: { decoration: { id: string }; rect?: DecorationRect }) => {
      listeners.onDecorationActivated(event.decoration.id, event.rect ?? null);
      return true;
    },
  } as never);

  // Applied once loaded so an out-of-range value can never block the first render.
  try {
    await nav.submitPreferences(toEpubPreferences(settings) as never);
  } catch (e) {
    console.warn("[reader] initial submitPreferences failed", e);
  }

  // ReadiumCSS computes column geometry once from the iframe's inner width, and a fresh frame can do that before the fill
  // width is painted (leaving 300px); nudging resize recomputes it, and is a no-op once it matches.
  const forceRelayout = (): Promise<void> => {
    const rh = (nav as unknown as { resizeHandler?: () => Promise<void> }).resizeHandler;
    return typeof rh === "function" ? rh.call(nav).catch(() => {}) : Promise.resolve();
  };

  // Once the fill width is painted, recompute geometry then re-navigate to the saved locator (the relayout can shift it a
  // page). Both finish before ready: Readium drops any navigation made while another is in flight.
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  await forceRelayout();
  if (initialLocator) await new Promise<void>((done) => nav.go(initial, false, () => done()));
  listeners.onReady();

  const findByProgression = (fraction: number): ReadiumLocator => {
    const clamped = Math.max(0, Math.min(1, fraction));
    let best = positions[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const p of positions) {
      const tp = p.locations?.totalProgression ?? 0;
      const diff = Math.abs(tp - clamped);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    return best;
  };

  const toc: TocEntry[] = (manifest.toc?.items ?? []).map((l) => ({
    href: l.href,
    title: l.title ?? l.href,
  }));

  return {
    toc,
    next: () => nav.goForward(false, () => {}),
    prev: () => nav.goBackward(false, () => {}),
    goToHref: (href: string) => {
      const link = pub.readingOrder.items.find(
        (l) => l.href === href || href.startsWith(l.href) || l.href.startsWith(href.split("#")[0]),
      );
      if (link) nav.goLink(link, false, () => {});
    },
    goToLocator: (locator: Locator) => {
      const loc = ReadiumLocator.deserialize(locator);
      if (loc) nav.go(loc, false, () => {});
    },
    goToTotalProgression: (fraction: number) =>
      nav.go(findByProgression(fraction), false, () => {}),
    applyHighlights: (specs: HighlightSpec[], theme: ReaderTheme) => {
      const marks = specs.map((s) => ({
        id: s.id,
        locator: ReadiumLocator.deserialize(s.locator) ?? s.locator,
        style:
          s.ownership === "other"
            ? otherDecorationStyleFor(s.color, theme)
            : decorationStyleFor(s.color, theme),
      }));
      nav.applyDecorations(marks as never, ANNOTATION_GROUP);
      // The note outline is a separate group so it stays purely visual; only your own notes get it.
      const notes = specs
        .filter((s) => s.hasNote && s.ownership === "mine")
        .map((s) => ({
          id: s.id,
          locator: ReadiumLocator.deserialize(s.locator) ?? s.locator,
          style: noteOutlineStyleFor(s.color, theme),
        }));
      nav.applyDecorations(notes as never, NOTE_GROUP);
    },
    applyPopular: (specs: PopularSpec[], theme: ReaderTheme) => {
      const marks = specs.map((s) => ({
        id: s.id,
        locator: ReadiumLocator.deserialize(s.locator) ?? s.locator,
        style: popularDecorationStyleFor(theme),
      }));
      nav.applyDecorations(marks as never, POPULAR_GROUP);
    },
    applySettings: async (next: ReaderSettings) => {
      await nav.submitPreferences(toEpubPreferences(next) as never);
      // Deferred a frame so the container's new max-width (which tracks the column count) is committed before measuring.
      requestAnimationFrame(() => void forceRelayout());
    },
    currentLocator: () => {
      try {
        return serialize(nav.currentLocator);
      } catch {
        return null;
      }
    },
    destroy: async () => {
      await nav.destroy();
    },
  };
}
