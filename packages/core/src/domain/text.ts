// Pure text helpers. normalizeText is the popular-highlights aggregation key
// (lesson from the old CFI-aggregation bug: aggregate on normalized selected text,
// not on locator/CFI). Same input from any client must produce the same key.
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining diacritics left by NFKD
    .replace(/[^\p{L}\p{N}\s]/gu, "") // drop punctuation/symbols
    .replace(/\s+/g, " ")
    .trim();
}
