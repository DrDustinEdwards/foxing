import type { HighlightColor } from "@foxing/core";
import type { DecorationRect } from "~/lib/reader/engine.client";
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

export type LayerState = { mine: boolean; clubs: boolean; everyone: boolean };

const DEFAULT_LAYERS: LayerState = { mine: true, clubs: false, everyone: false };

export const LAYERS_KEY = "foxing.reader.layers";

export const SETTINGS_KEY = "foxing.reader.settings";

export const PROGRESS_DEBOUNCE = 1500;

export function layerShown(layer: ReaderOther["layer"], state: LayerState): boolean {
  if (layer === "public") return state.everyone;
  return state.clubs; // club | friend
}

export function parseLayers(raw: string | null): LayerState {
  try {
    return raw ? { ...DEFAULT_LAYERS, ...JSON.parse(raw) } : DEFAULT_LAYERS;
  } catch {
    return DEFAULT_LAYERS;
  }
}

export function samePosition(a: Locator | null, b: Locator | null): boolean {
  if (!a || !b || a.href !== b.href) return false;
  return Math.abs(progressionOf(a) - progressionOf(b)) < 1e-4;
}

function progressionOf(loc: Locator): number {
  const l = loc.locations ?? {};
  const v = typeof l.totalProgression === "number" ? l.totalProgression : l.progression;
  return typeof v === "number" ? v : 0;
}

export function visibleFrame(container: HTMLElement | null): HTMLIFrameElement | null {
  if (!container) return null;
  const frames = Array.from(container.querySelectorAll("iframe"));
  return (
    frames.find((f) => f.style.visibility !== "hidden" && f.style.opacity !== "0") ??
    frames[0] ??
    null
  );
}

export function parseSettings(raw: string | null): ReaderSettings {
  try {
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** The mine/others decorations to draw: "My clubs" = club + friend, "Everyone" = public. */
export function highlightSpecs(
  mine: ReaderAnnotation[],
  othersList: ReaderOther[],
  layerState: LayerState,
) {
  const mineSpecs = layerState.mine
    ? mine
        .filter((a) => (a.type === "highlight" || a.type === "note") && a.locator)
        .map((a) => ({
          id: a.id,
          locator: a.locator as Locator,
          color: (a.color as HighlightColor) ?? "amber",
          hasNote: !!a.body?.trim(),
          ownership: "mine" as const,
        }))
    : [];
  const otherSpecs = othersList
    .filter((o) => o.locator && layerShown(o.layer, layerState))
    .map((o) => ({
      id: o.id,
      locator: o.locator as Locator,
      color: (o.color as HighlightColor) ?? "amber",
      hasNote: !!o.body?.trim(),
      ownership: "other" as const,
    }));
  return [...mineSpecs, ...otherSpecs];
}

/** The rect is in device pixels relative to the content frame's viewport: convert to CSS pixels and offset by the frame's position. */
export function anchorFromRect(container: HTMLElement | null, rect: DecorationRect | null) {
  // The engine pools frames, so pick the shown one, not the first in DOM order.
  const fr = visibleFrame(container)?.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return rect && fr
    ? {
        top: fr.top + rect.top / dpr,
        left: fr.left + rect.left / dpr,
        width: rect.width / dpr,
        height: rect.height / dpr,
      }
    : null;
}

export function popularSpecs(popular: ReaderPopular[], layerState: LayerState) {
  return layerState.everyone
    ? popular
        .filter((p) => p.locator)
        .map((p, i) => ({ id: `popular-${i}`, locator: p.locator as Locator }))
    : [];
}
