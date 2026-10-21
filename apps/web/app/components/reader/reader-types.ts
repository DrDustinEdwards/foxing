import type { Locator } from "~/lib/reader/locator";
import { DEFAULT_SETTINGS, type ReaderSettings } from "~/lib/reader/settings";

export interface ReaderAnnotation {
  id: string;
  type: "highlight" | "note" | "bookmark";
  locator: Locator | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
}

export interface AnnotationAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

// Another reader's shared annotation, resolved + tagged server-side. `gate` is the
// courtesy collapse decision (spoiler/ahead); the body is present so tap-to-reveal is
// instant, but rendered collapsed until revealed.
export interface ReaderOther {
  id: string;
  type: "highlight" | "note";
  locator: Locator | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
  layer: "club" | "friend" | "public";
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: { spoiler: boolean; ahead: boolean };
  author: AnnotationAuthor;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
}

export interface ReaderComment {
  id: string;
  clubId: string | null;
  parentId: string | null;
  locator: Locator | null;
  body: string | null;
  chapter: string | null;
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: { spoiler: boolean; ahead: boolean };
  author: AnnotationAuthor;
  createdAt: string | number | Date;
}

export interface ReaderPopular {
  normalizedText: string;
  count: number;
  locator: Locator | null;
}

// Which social layers the reader shows. Persisted per user in localStorage; mine is on
// by default, the social layers off (opt-in), so the reader opens as a private surface.
export type LayerState = { mine: boolean; clubs: boolean; everyone: boolean };

export const DEFAULT_LAYERS: LayerState = { mine: true, clubs: false, everyone: false };

export const LAYERS_KEY = "foxing.reader.layers";

export const SETTINGS_KEY = "foxing.reader.settings";

export const PROGRESS_DEBOUNCE = 1500;

// "My clubs" shows club + friend layers; "Everyone" shows public. Popular follows
// "Everyone" too. One place decides the mapping so the toggles and the redraw agree.
export function layerShown(layer: ReaderOther["layer"], state: LayerState): boolean {
  if (layer === "public") return state.everyone;
  return state.clubs; // club | friend
}

export function loadLayers(): LayerState {
  if (typeof localStorage === "undefined") return DEFAULT_LAYERS;
  try {
    const raw = localStorage.getItem(LAYERS_KEY);
    return raw ? { ...DEFAULT_LAYERS, ...JSON.parse(raw) } : DEFAULT_LAYERS;
  } catch {
    return DEFAULT_LAYERS;
  }
}

// Two locators point at the same reading position when they share a resource and
// their progression matches within a hair. Used to skip redundant progress saves,
// which otherwise fire (and flash "Saving...") for the position we just restored.
export function samePosition(a: Locator | null, b: Locator | null): boolean {
  if (!a || !b || a.href !== b.href) return false;
  return Math.abs(progressionOf(a) - progressionOf(b)) < 1e-4;
}

function progressionOf(loc: Locator): number {
  const l = loc.locations ?? {};
  const v = typeof l.totalProgression === "number" ? l.totalProgression : l.progression;
  return typeof v === "number" ? v : 0;
}

// The engine keeps a pool of content frames (current, prev, next); only one is
// shown at a time, the rest are hidden (visibility:hidden, opacity:0). Activation
// rects are relative to the shown frame, so anchor against that one.
export function visibleFrame(container: HTMLElement | null): HTMLIFrameElement | null {
  if (!container) return null;
  const frames = Array.from(container.querySelectorAll("iframe"));
  return (
    frames.find((f) => f.style.visibility !== "hidden" && f.style.opacity !== "0") ??
    frames[0] ??
    null
  );
}

export function loadSettings(): ReaderSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
