// The pure half of the reader social-layer resolution: the spoiler/progress gate.
// The full entitlement matrix (who sees whose annotations) runs against local D1 in
// apps/web/test/reader-social.integration.test.ts; here we prove the gate arithmetic in
// isolation. The gate is a COURTESY over content the viewer is already entitled to see,
// so it only decides collapsed-vs-shown, never access.
import { describe, expect, it } from "vitest";
import { annotationPct, computeGate } from "../src/domain/reader-annotations";

const loc = (totalProgression: number | undefined) => ({
  href: "chap.html",
  type: "text/html",
  locations: totalProgression === undefined ? {} : { totalProgression },
});

describe("annotationPct", () => {
  it("reads totalProgression as a whole-book percentage", () => {
    expect(annotationPct(loc(0))).toBe(0);
    expect(annotationPct(loc(0.5))).toBe(50);
    expect(annotationPct(loc(1))).toBe(100);
    expect(annotationPct(loc(0.4567))).toBe(45.7);
  });

  it("clamps out-of-range progression", () => {
    expect(annotationPct(loc(-1))).toBe(0);
    expect(annotationPct(loc(2))).toBe(100);
  });

  it("returns null when there is no progression (gate cannot fire on position)", () => {
    expect(annotationPct(loc(undefined))).toBeNull();
    expect(annotationPct(null)).toBeNull();
    expect(annotationPct(undefined)).toBeNull();
    expect(annotationPct({ href: "x", type: "t" })).toBeNull();
  });
});

describe("computeGate (cells 11, 12, 13)", () => {
  it("cell 11: ahead when the item sits past the viewer's position, not when at/behind", () => {
    // ahead
    expect(
      computeGate({ containsSpoilers: false, annPct: 60, viewerPct: 40, progressGate: true }).ahead,
    ).toBe(true);
    // behind
    expect(
      computeGate({ containsSpoilers: false, annPct: 20, viewerPct: 40, progressGate: true }).ahead,
    ).toBe(false);
    // same position (within epsilon) is NOT ahead
    expect(
      computeGate({ containsSpoilers: false, annPct: 40.3, viewerPct: 40, progressGate: true })
        .ahead,
    ).toBe(false);
    // just past the epsilon IS ahead
    expect(
      computeGate({ containsSpoilers: false, annPct: 40.6, viewerPct: 40, progressGate: true })
        .ahead,
    ).toBe(true);
  });

  it("cell 12: the manual spoiler flag is independent of progress", () => {
    // marked spoiler but behind the viewer: still a spoiler
    const g = computeGate({
      containsSpoilers: true,
      annPct: 10,
      viewerPct: 90,
      progressGate: true,
    });
    expect(g.spoiler).toBe(true);
    expect(g.ahead).toBe(false);
    // not marked, behind: neither
    expect(
      computeGate({ containsSpoilers: false, annPct: 10, viewerPct: 90, progressGate: true }),
    ).toEqual({ spoiler: false, ahead: false });
  });

  it("progressGate=off disables the ahead gate but not the manual spoiler flag", () => {
    expect(
      computeGate({ containsSpoilers: false, annPct: 99, viewerPct: 1, progressGate: false }).ahead,
    ).toBe(false);
    expect(
      computeGate({ containsSpoilers: true, annPct: 99, viewerPct: 1, progressGate: false })
        .spoiler,
    ).toBe(true);
  });

  it("cell 13: missing annPct or viewerPct cannot fire the ahead gate; spoiler flag still honored", () => {
    // no annotation progression
    expect(
      computeGate({ containsSpoilers: false, annPct: null, viewerPct: 10, progressGate: true }),
    ).toEqual({ spoiler: false, ahead: false });
    // anonymous / unknown viewer position
    expect(
      computeGate({ containsSpoilers: false, annPct: 90, viewerPct: null, progressGate: true }),
    ).toEqual({ spoiler: false, ahead: false });
    // still honors the manual flag with unknown positions
    expect(
      computeGate({ containsSpoilers: true, annPct: null, viewerPct: null, progressGate: true })
        .spoiler,
    ).toBe(true);
  });
});
