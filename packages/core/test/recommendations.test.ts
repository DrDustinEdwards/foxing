import { describe, expect, it } from "vitest";
import type { RecCandidate } from "../src/repositories";
import { parseAiSelection, rankCandidates, type RankSignals } from "../src/domain/recommendations";

function cand(over: Partial<RecCandidate> & { id: string }): RecCandidate {
  return {
    slug: over.id,
    title: over.id,
    author: "Anon",
    authorSlug: null,
    coverUrl: "cover",
    publicationYear: 1900,
    subjects: [],
    weightedRating: null,
    ratingCount: 0,
    isStaffPick: false,
    ...over,
  };
}

const NO_SIGNALS: RankSignals = {
  favoriteGenres: [],
  behaviorGenres: [],
  favoriteAuthors: [],
  exampleByAuthor: {},
};

describe("rankCandidates - tier 1 (taste) and baseline", () => {
  it("with no signals, award + highly-rated books float to the top with generic reasons", () => {
    const candidates = [
      cand({ id: "plain", weightedRating: 3, ratingCount: 10 }),
      cand({ id: "award", weightedRating: 4, ratingCount: 50 }),
    ];
    const ranked = rankCandidates(candidates, NO_SIGNALS, new Set(["award"]));
    expect(ranked[0].candidate.id).toBe("award");
    expect(ranked[0].reason).toBe("Award winner");
    // The non-award book falls back to the generic reason, never a fake personal one.
    expect(ranked[1].reason).toBe("Loved by readers");
  });

  it("seeds from favourite_genres: a genre match outranks an unrelated book", () => {
    const signals: RankSignals = { ...NO_SIGNALS, favoriteGenres: ["Gothic"] };
    const candidates = [
      cand({ id: "unrelated", weightedRating: 3.5, ratingCount: 20, subjects: ["Romance"] }),
      cand({ id: "gothic", weightedRating: 3, ratingCount: 5, subjects: ["gothic"] }),
    ];
    const ranked = rankCandidates(candidates, signals, new Set());
    expect(ranked[0].candidate.id).toBe("gothic");
    // Reason uses the book's own subject label (case preserved), not the typed genre.
    expect(ranked[0].reason).toBe("Popular in gothic");
  });

  it("an award winner in a favourite genre reads as 'Award winner in <genre>'", () => {
    const signals: RankSignals = { ...NO_SIGNALS, favoriteGenres: ["Gothic"] };
    const ranked = rankCandidates(
      [cand({ id: "g", subjects: ["Gothic"], weightedRating: 4 })],
      signals,
      new Set(["g"]),
    );
    expect(ranked[0].reason).toBe("Award winner in Gothic");
  });

  it("empty genres + no history is a valid curated fallback (no crash, ranks by quality)", () => {
    const candidates = [
      cand({ id: "a", weightedRating: 2, ratingCount: 3 }),
      cand({ id: "b", weightedRating: 4.5, ratingCount: 80 }),
    ];
    const ranked = rankCandidates(candidates, NO_SIGNALS, new Set());
    expect(ranked.map((r) => r.candidate.id)).toEqual(["b", "a"]);
  });
});

describe("rankCandidates - tier 2 (behaviour) boosting", () => {
  it("a favourite author outranks a higher-rated stranger, with a 'More from' reason", () => {
    const signals: RankSignals = {
      ...NO_SIGNALS,
      favoriteAuthors: ["mary shelley"],
      exampleByAuthor: {},
    };
    const candidates = [
      cand({ id: "bestseller", author: "Someone Else", weightedRating: 5, ratingCount: 500 }),
      cand({ id: "shelley", author: "Mary Shelley", weightedRating: 2, ratingCount: 2 }),
    ];
    const ranked = rankCandidates(candidates, signals, new Set());
    expect(ranked[0].candidate.id).toBe("shelley");
    expect(ranked[0].reason).toBe("More from Mary Shelley");
  });

  it("uses the rated title when the author has a highly-rated example", () => {
    const signals: RankSignals = {
      ...NO_SIGNALS,
      favoriteAuthors: ["mary shelley"],
      exampleByAuthor: { "mary shelley": { title: "Frankenstein", rated: true } },
    };
    const ranked = rankCandidates(
      [cand({ id: "shelley", author: "Mary Shelley" })],
      signals,
      new Set(),
    );
    expect(ranked[0].reason).toBe("Because you rated Frankenstein highly");
  });

  it("boosts a genre the reader actually reads with a behaviour reason", () => {
    const signals: RankSignals = { ...NO_SIGNALS, behaviorGenres: ["Gothic"] };
    const ranked = rankCandidates([cand({ id: "g", subjects: ["Gothic"] })], signals, new Set());
    expect(ranked[0].reason).toBe("More Gothic, which you read");
  });
});

describe("parseAiSelection", () => {
  const allowed = new Set(["a", "b", "c"]);

  it("parses a strict array, keeping only allowed ids and one line reasons", () => {
    const text = `[{"book_id":"a","reason":"  Dark  and\\ntense  "},{"book_id":"b","reason":"Cozy"}]`;
    expect(parseAiSelection(text, allowed)).toEqual([
      { bookId: "a", reason: "Dark and tense" },
      { bookId: "b", reason: "Cozy" },
    ]);
  });

  it("tolerates prose around the array and drops unknown/duplicate ids", () => {
    const text = `Here you go: [{"book_id":"a","reason":"x"},{"book_id":"zzz","reason":"y"},{"book_id":"a","reason":"dup"}] done`;
    expect(parseAiSelection(text, allowed)).toEqual([{ bookId: "a", reason: "x" }]);
  });

  it("returns null on malformed JSON so the caller falls back to data ranking", () => {
    expect(parseAiSelection("not json at all", allowed)).toBeNull();
    expect(parseAiSelection("[{book_id:'a'}]", allowed)).toBeNull();
    expect(parseAiSelection("[]", allowed)).toBeNull();
  });
});
