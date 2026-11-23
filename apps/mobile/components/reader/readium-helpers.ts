import type { ReaderSettings } from "@/components/reader/reader-types";
import type { Locator, Preferences } from "react-native-readium";

// Soften a 6-digit hex color to an 8-digit one with ~20% alpha so the
// popular-highlight tint sits behind text instead of competing with
// it. Pass-through for inputs we can't parse.
export function toSoftTint(hex: string): string {
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex + "33";
  if (/^#[0-9a-f]{8}$/i.test(hex)) return hex;
  return hex;
}

// Splits chapter text into utterances; TtsBar and highlightSentence share it so indexes line up.
export function splitSentences(chapterText: string): string[] {
  const parts = (chapterText ?? "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

const READIUM_BG_TO_THEME: Array<[RegExp, "light" | "dark" | "sepia"]> = [
  [/^#0/i, "dark"],
  [/^#1/i, "dark"],
  [/e8|f4|f5/i, "sepia"],
];

function deriveReadiumTheme(bg: string): "light" | "dark" | "sepia" {
  const lower = bg.toLowerCase();
  for (const [pattern, value] of READIUM_BG_TO_THEME) {
    if (pattern.test(lower)) return value;
  }
  return "light";
}

export function settingsToReadiumPreferences(s: ReaderSettings): Preferences {
  return {
    theme: deriveReadiumTheme(s.theme.background),
    fontSize: Math.max(0.5, Math.min(2.0, s.fontSize / 16)),
  };
}

// CFI <-> Locator conversion. Readium uses its own Locator shape, stored
// as the whole Locator stringified where progress_cfi used to live. Any
// string that is not Locator JSON decodes to undefined.
export function decodeLocator(cfi: string | undefined): Locator | undefined {
  if (!cfi) return undefined;
  if (!cfi.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(cfi) as Locator;
    if (parsed && typeof parsed.href === "string") return parsed;
  } catch {
    return undefined;
  }
  return undefined;
}

export function encodeLocator(locator: Locator | Record<string, unknown>): string {
  return JSON.stringify(locator);
}

// Comments on one passage share this key: the chapter plus the first 200 characters of the passage text.
export function locatorKey(locator: { href: string; text?: { highlight?: string } }): string {
  return `${locator.href}|${(locator.text?.highlight ?? "").slice(0, 200)}`;
}
