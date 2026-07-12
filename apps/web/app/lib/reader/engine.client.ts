// Client-only Readium ts-toolkit wiring. Imported dynamically by the reader
// component (inside an effect) so none of this evaluates during SSR. Wraps the
// EpubNavigator behind a small imperative API and extracts the R1 selection
// context (before/after + cssSelector) from the content frame at selection time.
import { HttpFetcher, Locator as ReadiumLocator, Manifest, Publication } from "@readium/shared";
import { EpubNavigator, type EpubNavigatorListeners } from "@readium/navigator";
import type { HighlightColor } from "@foxing/core";
import { decorationStyleFor } from "./locator";
import type { Locator, SelectionContext } from "./locator";
import type { ReaderSettings, ReaderTheme } from "./settings";
import { initialEpubPreferences, toEpubPreferences } from "./settings";

const CONTEXT_CHARS = 40;
const ANNOTATION_GROUP = "annotations";

export interface HighlightSpec {
  id: string;
  locator: Locator;
  color: HighlightColor;
}

export interface SelectionPayload {
  text: string;
  locator: Locator;
  context: SelectionContext;
  rect: { x: number; y: number; width: number; height: number } | null;
}

export interface EngineListeners {
  onPosition: (locator: Locator) => void;
  onSelection: (payload: SelectionPayload) => void;
  onDecorationActivated: (id: string) => void;
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
  applySettings: (settings: ReaderSettings) => Promise<void>;
  currentLocator: () => Locator | null;
  destroy: () => Promise<void>;
}

function serialize(loc: unknown): Locator {
  const anyLoc = loc as { serialize?: () => Locator };
  return anyLoc?.serialize ? anyLoc.serialize() : (loc as Locator);
}

// Read the active content frame's live selection to build the TextQuoteAnchor
// context the ts-toolkit decorator uses (exact + prefix/suffix) plus a cssSelector
// root. Content frames are same-origin blob iframes, so the parent can read them.
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

    // Character offset of the selection start/end within the root's textContent.
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

export async function createEngine(opts: CreateEngineOptions): Promise<ReaderEngine> {
  const { container, manifestUrl, initialLocator, settings, listeners } = opts;

  const manifestJson = await (await fetch(manifestUrl)).json();
  const manifest = Manifest.deserialize(manifestJson);
  if (!manifest) throw new Error("invalid manifest");
  manifest.setSelfLink(manifestUrl);

  const fetcher = new HttpFetcher(window.fetch.bind(window), manifest.baseURL);
  const pub = new Publication({ manifest, fetcher });

  // Real position list (from the manifest's position-list link) drives the
  // scrubber; fall back to one-per-resource only if the link is absent.
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
  } as never);
  await nav.load();

  nav.registerDecorationObserver(ANNOTATION_GROUP, {
    onDecorationActivated: (event: { decoration: { id: string } }) => {
      listeners.onDecorationActivated(event.decoration.id);
      return true;
    },
  } as never);

  // Apply full typography once loaded (kept out of the constructor so an
  // out-of-range value can never block the first render).
  try {
    await nav.submitPreferences(toEpubPreferences(settings) as never);
  } catch (e) {
    console.warn("[reader] initial submitPreferences failed", e);
  }

  // The content frame's ReadiumCSS computes its column geometry once, from the
  // iframe's inner width. Our CSS sizes .readium-navigator-iframe to fill the
  // (centered, max-width) container, but a freshly-loaded frame can run that
  // one-shot compute before the fill width is painted, leaving the book laid out
  // in the intrinsic 300px. Nudging the navigator's resize recomputes against the
  // real width; it is a no-op once geometry already matches.
  const forceRelayout = (): Promise<void> => {
    const rh = (nav as unknown as { resizeHandler?: () => Promise<void> }).resizeHandler;
    return typeof rh === "function" ? rh.call(nav).catch(() => {}) : Promise.resolve();
  };

  listeners.onReady();
  // Recompute geometry against the real width, then snap back to the saved
  // locator. The relayout re-paginates the resource, which can shift the saved
  // progression onto a neighboring page (it was landing a page early), so we
  // re-navigate afterward to land on the exact saved page.
  requestAnimationFrame(() =>
    requestAnimationFrame(async () => {
      await forceRelayout();
      if (initialLocator) nav.go(initial, false, () => {});
    }),
  );

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
      const decorations = specs.map((s) => ({
        id: s.id,
        locator: ReadiumLocator.deserialize(s.locator) ?? s.locator,
        style: decorationStyleFor(s.color, theme),
      }));
      nav.applyDecorations(decorations as never, ANNOTATION_GROUP);
    },
    applySettings: async (next: ReaderSettings) => {
      await nav.submitPreferences(toEpubPreferences(next) as never);
      // Column-count / scroll / font changes shift the geometry; recompute against
      // the container's current width. Deferred a frame so the container's new
      // max-width (which tracks the column count) is committed before we measure.
      requestAnimationFrame(forceRelayout);
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
