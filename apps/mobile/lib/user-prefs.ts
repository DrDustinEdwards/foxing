// Cross-screen user preferences that don't belong to a single component.
// Persisted to AsyncStorage with a single namespaced key so a future
// migration to a `profiles.preferences` JSONB column can pull the same shape.

import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFS_KEY = 'user_prefs_v1'
const WPM_KEY = 'user_calibrated_wpm'

export type AppLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ja' | 'zh'
export type AiLanguage = AppLanguage
export type SpeedUnit = 'wpm' | 'pages_per_hour'

export interface UserPrefs {
  appLanguage: AppLanguage
  aiLanguage: AiLanguage
  // For displaying reading rate in the reader / coach screens.
  speedUnit: SpeedUnit
  // When true, the reader saves font/theme keyed by book_id and prefers
  // that over the global default on next open.
  rememberPerBook: boolean
}

export const DEFAULT_USER_PREFS: UserPrefs = {
  appLanguage: 'en',
  aiLanguage: 'en',
  speedUnit: 'wpm',
  rememberPerBook: false,
}

export async function getUserPrefs(): Promise<UserPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_USER_PREFS
    return { ...DEFAULT_USER_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) }
  } catch {
    return DEFAULT_USER_PREFS
  }
}

export async function setUserPrefs(next: UserPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next))
}

// Calibrated WPM is owned by the reader, but the settings screen lets the
// user inspect and reset it. Kept separate from UserPrefs so it can be
// updated without serializing the whole prefs blob on every page turn.
export async function getCalibratedWpm(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(WPM_KEY)
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function setCalibratedWpm(wpm: number): Promise<void> {
  await AsyncStorage.setItem(WPM_KEY, String(Math.round(wpm)))
}

export async function clearCalibratedWpm(): Promise<void> {
  await AsyncStorage.removeItem(WPM_KEY)
}

export const APP_LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
]
