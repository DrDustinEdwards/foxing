import { describe, expect, it } from "vitest";
import { resolveDefaultAnnotationVisibility } from "../src/domain/annotations";
import type { Profile } from "../src/repositories/profiles";

// A new highlight/note inherits the reader's default-annotation audience (Phase 6 wrote
// the pref; this is the read-side consumption). Anything unrecognised falls back to the
// safe default, private, so a bad or absent value never over-shares.
function profileWith(defaultAnnotation: unknown): Profile {
  return { visibility: { defaultAnnotation } } as unknown as Profile;
}

describe("resolveDefaultAnnotationVisibility", () => {
  it("returns public when the default is public", () => {
    expect(resolveDefaultAnnotationVisibility(profileWith("public"))).toBe("public");
  });

  it("returns friends when the default is close friends", () => {
    expect(resolveDefaultAnnotationVisibility(profileWith("friends"))).toBe("friends");
  });

  it("falls back to private when the default is private, absent, or unrecognised", () => {
    expect(resolveDefaultAnnotationVisibility(profileWith("private"))).toBe("private");
    expect(resolveDefaultAnnotationVisibility(profileWith(undefined))).toBe("private");
    expect(resolveDefaultAnnotationVisibility(profileWith("nonsense"))).toBe("private");
    expect(resolveDefaultAnnotationVisibility({} as Profile)).toBe("private");
  });
});
