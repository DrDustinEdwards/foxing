import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFS_KEY = "user_prefs_v1";
const WPM_KEY = "user_calibrated_wpm";

type SpeedUnit = "wpm" | "pages_per_hour";

export interface UserPrefs {
  speedUnit: SpeedUnit;
}

export const DEFAULT_USER_PREFS: UserPrefs = { speedUnit: "wpm" };

export async function getUserPrefs(): Promise<UserPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_USER_PREFS;
    return { ...DEFAULT_USER_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) };
  } catch {
    return DEFAULT_USER_PREFS;
  }
}

export async function setUserPrefs(next: UserPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
}

export async function getCalibratedWpm(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(WPM_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setCalibratedWpm(wpm: number): Promise<void> {
  await AsyncStorage.setItem(WPM_KEY, String(Math.round(wpm)));
}
