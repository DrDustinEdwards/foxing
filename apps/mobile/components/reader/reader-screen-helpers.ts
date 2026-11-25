import { type CanvasTheme, FONT_SIZE_PX, type ReaderPrefs } from "@/lib/reader-settings";
import { Colors } from "@/constants/colors";
import type { ReaderSettings } from "@/components/reader/reader-types";

export const CANVAS_PALETTE: Record<CanvasTheme, { background: string; text: string }> = {
  default: { background: Colors.light.bgReading, text: Colors.light.textPrimary },
  sepia: { background: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia },
  dark: { background: Colors.dark.bgReading, text: Colors.dark.textPrimary },
  oled: { background: Colors.dark.bgReadingOled, text: Colors.dark.textOnDark },
};

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Translucent chrome without RN `opacity`, which would fade the icons too.
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function prefsToSettings(prefs: ReaderPrefs): ReaderSettings {
  return { fontSize: FONT_SIZE_PX[prefs.fontSize], theme: CANVAS_PALETTE[prefs.canvasTheme] };
}
