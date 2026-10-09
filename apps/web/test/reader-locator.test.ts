import { describe, expect, it } from "vitest";
import {
  enrichSelectionLocator,
  progressPctFromLocator,
  tintFor,
  type Locator,
} from "../app/lib/reader/locator";
import { toEpubPreferences, DEFAULT_SETTINGS } from "../app/lib/reader/settings";

describe("enrichSelectionLocator (R1/R2)", () => {
  const base: Locator = {
    href: "epub/text/chapter-5.xhtml",
    type: "application/xhtml+xml",
    locations: { fragments: [] },
    text: { highlight: "the sea" },
  };

  it("R1: keeps before/after context and cssSelector so duplicate phrases re-anchor", () => {
    const out = enrichSelectionLocator(
      base,
      { before: "sailed upon ", after: " that day", cssSelector: "#c5 > p:nth-child(3)" },
      undefined,
    );
    expect(out.text?.before).toBe("sailed upon ");
    expect(out.text?.after).toBe(" that day");
    expect(out.text?.highlight).toBe("the sea"); // preserved
    expect(out.locations?.cssSelector).toBe("#c5 > p:nth-child(3)");
    expect(out.href).toBe(base.href);
    expect(out.type).toBe(base.type);
  });

  it("R2: merges the current reading position's locations", () => {
    const out = enrichSelectionLocator(
      base,
      { before: "x", after: "y" },
      {
        progression: 0.4,
        position: 9,
        totalProgression: 0.27,
      },
    );
    expect(out.locations?.progression).toBe(0.4);
    expect(out.locations?.position).toBe(9);
    expect(out.locations?.totalProgression).toBe(0.27);
    // the selection's own locations still win over position defaults
    expect(out.locations?.fragments).toEqual([]);
  });

  it("omits before/after when no context is available (no crash)", () => {
    const out = enrichSelectionLocator(base, {}, undefined);
    expect(out.text?.highlight).toBe("the sea");
    expect(out.text?.before).toBeUndefined();
  });
});

describe("progressPctFromLocator", () => {
  it("derives a 0..100 percentage from totalProgression", () => {
    expect(
      progressPctFromLocator({ href: "a", type: "t", locations: { totalProgression: 0.276 } }),
    ).toBe(27.6);
    expect(progressPctFromLocator({ href: "a", type: "t", locations: {} })).toBe(0);
    expect(progressPctFromLocator(null)).toBe(0);
    expect(
      progressPctFromLocator({ href: "a", type: "t", locations: { totalProgression: 1 } }),
    ).toBe(100);
  });
});

describe("tintFor", () => {
  it("returns dark-mode tints in dark theme, light tints otherwise", () => {
    expect(tintFor("amber", "light")).toBe("#FEF0C0");
    expect(tintFor("amber", "sepia")).toBe("#FEF0C0");
    expect(tintFor("amber", "dark")).toBe("#2E2008");
  });
});

describe("toEpubPreferences", () => {
  it("clamps out-of-range typography and maps theme colors", () => {
    const prefs = toEpubPreferences({
      ...DEFAULT_SETTINGS,
      theme: "dark",
      fontSize: 9,
      lineHeight: 0.1,
    });
    expect(prefs.fontSize).toBeLessThanOrEqual(1.8);
    expect(prefs.lineHeight).toBeGreaterThanOrEqual(1.2);
    expect(prefs.backgroundColor).toBe("#1A1410");
    expect(prefs.textColor).toBe("#F5EDDE");
  });

  it("forces one column in scroll mode", () => {
    expect(toEpubPreferences({ ...DEFAULT_SETTINGS, scroll: true, columns: 2 }).columnCount).toBe(
      1,
    );
    expect(toEpubPreferences({ ...DEFAULT_SETTINGS, scroll: false, columns: 2 }).columnCount).toBe(
      2,
    );
  });
});
