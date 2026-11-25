// normalizeText is the popular-highlights aggregation key: aggregate on normalized selected text, not locator/CFI; the same input from any
// client must give the same key.
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining diacritics left by NFKD
    .replace(/[^\p{L}\p{N}\s]/gu, "") // drop punctuation/symbols
    .replace(/\s+/g, " ")
    .trim();
}
