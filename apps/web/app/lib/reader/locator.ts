// Pure Locator helpers for the reader: highlight tints (design-system --hl-*),
// R1/R2 selection-Locator enrichment, and progress math. No DOM, no ts-toolkit
// imports, so this is unit-testable (the R1 multi-occurrence guarantee is proven
// by an e2e reload test; the merge shape is proven here).
import type { HighlightColor } from "@foxing/core";

export interface Locator {
  href: string;
  type: string;
  title?: string;
  locations?: Record<string, unknown>;
  text?: { before?: string; highlight?: string; after?: string; [k: string]: unknown };
  [k: string]: unknown;
}

/** Highlight background tints per theme (design-system.md "Annotation Highlight
 *  Colors" --hl-* bg values). Concrete hex because decorations render inside the
 *  content iframe where the app's CSS vars are not defined. */
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

export function decorationStyleFor(color: HighlightColor, theme: "light" | "sepia" | "dark") {
  return { type: "highlight", tint: tintFor(color, theme) };
}

export interface SelectionContext {
  before?: string;
  after?: string;
  cssSelector?: string;
}

/**
 * R1 + R2: enrich a raw selection Locator so annotations re-anchor to the right
 * occurrence. R1 keeps text.before/after (the TextQuoteAnchor prefix/suffix the
 * ts-toolkit decorator uses to disambiguate duplicate phrases) and cssSelector
 * (narrows the search root). R2 merges the current reading position's
 * progression/position/totalProgression so jump-to-annotation does not depend on
 * text re-anchoring alone. Extras the navigator already provided are preserved.
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
    ...(positionLocations ?? {}),
    ...(base.locations ?? {}),
    ...(ctx.cssSelector ? { cssSelector: ctx.cssSelector } : {}),
  };
  return { ...base, text, locations };
}

/** Whole-book percentage (0..100) from a Locator's totalProgression. */
export function progressPctFromLocator(locator: Locator | null | undefined): number {
  const tp = locator?.locations?.totalProgression;
  const n = typeof tp === "number" ? tp : 0;
  return Math.round(Math.min(1, Math.max(0, n)) * 1000) / 10;
}
