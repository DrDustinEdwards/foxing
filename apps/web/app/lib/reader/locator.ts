// Pure Locator helpers for the reader (no DOM, no ts-toolkit imports, so unit-testable): highlight tints and selection-Locator enrichment.
import type { HighlightColor } from "@foxing/core";

export interface Locator {
  href: string;
  type: string;
  title?: string;
  locations?: Record<string, unknown>;
  text?: { before?: string; highlight?: string; after?: string; [k: string]: unknown };
  [k: string]: unknown;
}

/** Highlight tints per theme: concrete hex because decorations render inside the content iframe, where the app's CSS vars are not defined. */
const HL_TINTS: Record<"lightish" | "dark", Record<HighlightColor, string>> = {
  lightish: {
    amber: "#FEF0C0",
    auburn: "#FAD8C8",
    yellow: "#FAF3C6",
    sage: "#C8EDD5",
    cobalt: "#C8DFEF",
    crimson: "#F5D0DC",
    purple: "#DFD3EE",
  },
  dark: {
    amber: "#2E2008",
    auburn: "#2E1808",
    yellow: "#3D360B",
    sage: "#0A1E12",
    cobalt: "#081018",
    crimson: "#20080E",
    purple: "#231532",
  },
};

export function tintFor(color: HighlightColor, theme: "light" | "sepia" | "dark"): string {
  return HL_TINTS[theme === "dark" ? "dark" : "lightish"][color];
}

// The fill for a highlight/note; isActive makes it a click target in-frame.
export function decorationStyleFor(color: HighlightColor, theme: "light" | "sepia" | "dark") {
  return { type: "highlight", tint: tintFor(color, theme), isActive: true };
}

// Another reader's annotation: an underline in the author's color, still a click target, visibly distinct from your fill.
export function otherDecorationStyleFor(color: HighlightColor, theme: "light" | "sepia" | "dark") {
  return { type: "underline", tint: tintFor(color, theme), isActive: true };
}

// The popular-highlights layer: a faint, non-active underline so it stays ambient.
export function popularDecorationStyleFor(theme: "light" | "sepia" | "dark") {
  const tint = theme === "dark" ? "#3A3A3A" : "#D8D2C4";
  return { type: "underline", tint, isActive: false };
}

// The "has a note" outline box, a second non-active decoration; outline + layout:bounds always renders via the DOM overlay (the CSS Highlight API only fills backgrounds).
export function noteOutlineStyleFor(color: HighlightColor, theme: "light" | "sepia" | "dark") {
  return { type: "outline", tint: tintFor(color, theme), layout: "bounds", isActive: false };
}

export interface SelectionContext {
  before?: string;
  after?: string;
  cssSelector?: string;
}

/**
 * Enriches a raw selection Locator so annotations re-anchor to the right occurrence: keeps text.before/after and
 * cssSelector, and merges the current position's progression so jump-to-annotation does not rely on text re-anchoring
 * alone. Extras the navigator already provided are preserved.
 */
export function enrichSelectionLocator(
  base: Locator,
  ctx: SelectionContext,
  positionLocations: Record<string, unknown> | undefined,
): Locator {
  const text = {
    ...base.text,
    ...(ctx.before !== undefined ? { before: ctx.before } : {}),
    ...(ctx.after !== undefined ? { after: ctx.after } : {}),
  };
  const locations: Record<string, unknown> = {
    ...positionLocations,
    ...base.locations,
    ...(ctx.cssSelector ? { cssSelector: ctx.cssSelector } : {}),
  };
  return { ...base, text, locations };
}
