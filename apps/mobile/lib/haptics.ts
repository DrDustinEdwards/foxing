// Haptic wrapper gated on a per-user toggle; every call is try/catch because Android devices without a motor can throw.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const HAPTICS_KEY = "haptics_enabled";

// Cached preference so the AsyncStorage read stays off the critical path of every haptic.
let cached: boolean | null = null;

async function loadEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const raw = await AsyncStorage.getItem(HAPTICS_KEY);
    cached = raw === null ? true : raw === "true";
    return cached;
  } catch {
    cached = true;
    return true;
  }
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  cached = enabled;
  try {
    await AsyncStorage.setItem(HAPTICS_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export async function getHapticsEnabled(): Promise<boolean> {
  return loadEnabled();
}

function fire(impact: () => void): void {
  if (cached === false) return;
  if (cached === null) {
    void loadEnabled().then((on) => {
      if (on) {
        try {
          impact();
        } catch {}
      }
    });
    return;
  }
  try {
    impact();
  } catch {}
}

export const haptic = {
  light(): void {
    fire(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium(): void {
    fire(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  heavy(): void {
    fire(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  success(): void {
    fire(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    fire(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error(): void {
    fire(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  selection(): void {
    fire(() => void Haptics.selectionAsync());
  },
};
