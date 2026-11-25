import AsyncStorage from "@react-native-async-storage/async-storage";

export type CanvasTheme = "default" | "sepia" | "dark" | "oled";
export type FontSizeStep = "xs" | "s" | "m" | "l" | "xl" | "2xl" | "3xl";

export interface ReaderPrefs {
  fontSize: FontSizeStep;
  canvasTheme: CanvasTheme;
  popularHighlightsEnabled: boolean;
  targetLanguage: string;
}

export const DEFAULT_PREFS: ReaderPrefs = {
  fontSize: "m",
  canvasTheme: "dark",
  popularHighlightsEnabled: false,
  targetLanguage: "Spanish",
};

export const FONT_SIZE_PX: Record<FontSizeStep, number> = {
  xs: 14,
  s: 16,
  m: 18,
  l: 20,
  xl: 22,
  "2xl": 26,
  "3xl": 30,
};

const STORAGE_PREFIX = "foxing.reader-prefs.";

function key(userId: string | null): string {
  return `${STORAGE_PREFIX}${userId ?? "anon"}`;
}

export async function loadPrefs(userId: string | null): Promise<ReaderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    // Merge so newly added prefs default rather than undefined for existing users.
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(userId: string | null, prefs: ReaderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(prefs));
  } catch (e) {
    console.warn("[reader-settings] save failed:", e);
  }
}

export interface SavedTheme {
  id: string;
  name: string;
  prefs: ReaderPrefs;
  isPreset?: boolean;
}

const SAVED_KEY_PREFIX = "foxing.reader-themes.";

export const PRESET_THEMES: SavedTheme[] = [
  {
    id: "preset-compact",
    name: "Compact",
    isPreset: true,
    prefs: { ...DEFAULT_PREFS, fontSize: "s" },
  },
  {
    id: "preset-standard",
    name: "Standard",
    isPreset: true,
    prefs: { ...DEFAULT_PREFS },
  },
  {
    id: "preset-large",
    name: "Large",
    isPreset: true,
    prefs: { ...DEFAULT_PREFS, fontSize: "xl" },
  },
  {
    id: "preset-low-vision",
    name: "Low Vision",
    isPreset: true,
    prefs: { ...DEFAULT_PREFS, fontSize: "3xl" },
  },
];

export async function loadSavedThemes(userId: string | null): Promise<SavedTheme[]> {
  try {
    const raw = await AsyncStorage.getItem(`${SAVED_KEY_PREFIX}${userId ?? "anon"}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTheme[];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export async function saveCustomTheme(userId: string | null, theme: SavedTheme): Promise<void> {
  const existing = await loadSavedThemes(userId);
  const next = [theme, ...existing.filter((t) => t.id !== theme.id)].slice(0, 5);
  await AsyncStorage.setItem(`${SAVED_KEY_PREFIX}${userId ?? "anon"}`, JSON.stringify(next));
}
