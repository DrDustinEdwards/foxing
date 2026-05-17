// Haptic feedback wrapper, gated on a per-user AsyncStorage toggle so
// users can turn buzzing off entirely. expo-haptics is a JS-only API
// (talks to the platform native haptic engines), but we still wrap every
// call in try/catch, Android devices without a vibration motor return
// silently and we don't want a stray throw bubbling out of an onPress.

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'

const HAPTICS_KEY = 'haptics_enabled'

// In-memory cached preference. We load once on first call and keep the
// value cached so the AsyncStorage read isn't on the critical path of
// every haptic, those need to be sub-frame to feel right. The Settings
// screen calls `setHapticsEnabled` after a toggle which updates both
// AsyncStorage and the cache.
let cached: boolean | null = null

async function loadEnabled(): Promise<boolean> {
  if (cached !== null) return cached
  try {
    const raw = await AsyncStorage.getItem(HAPTICS_KEY)
    // Default ON, haptics are part of the "tactile reading" identity.
    cached = raw === null ? true : raw === 'true'
    return cached
  } catch {
    cached = true
    return true
  }
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  cached = enabled
  try {
    await AsyncStorage.setItem(HAPTICS_KEY, enabled ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export async function getHapticsEnabled(): Promise<boolean> {
  return loadEnabled()
}

// All wrappers are fire-and-forget. They check the cache synchronously
// after the first load; before that they may miss the first ever haptic,
// which is acceptable.
function fire(impact: () => void): void {
  if (cached === false) return
  if (cached === null) {
    // Best-effort warm-up; subsequent calls hit the cache.
    void loadEnabled().then((on) => {
      if (on) {
        try { impact() } catch {}
      }
    })
    return
  }
  try { impact() } catch {}
}

// ── Public surface, match the names the callsites use. ────────────────

export const haptic = {
  // Light: highlight save, bookmark add, pill appear, button press.
  light(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
  },
  // Medium: badge earned, streak milestone, level up.
  medium(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
  },
  // Heavier, reserved; not currently wired.
  heavy(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))
  },
  // Success: book marked finished, account-level wins.
  success(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  },
  warning(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
  },
  error(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
  },
  // Selection: tab bar tap, segmented control flip.
  selection(): void {
    fire(() => Haptics.selectionAsync())
  },
}
