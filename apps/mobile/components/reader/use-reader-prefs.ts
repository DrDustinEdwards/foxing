import { useEffect, useState, type RefObject } from "react";
import type { ReaderRef } from "@/components/reader/reader-types";
import { prefsToSettings } from "@/components/reader/reader-screen-helpers";
import { type ReaderPrefs, DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/reader-settings";

export function useReaderPrefs(
  userId: string | null,
  sessionPending: boolean,
  readerRef: RefObject<ReaderRef | null>,
) {
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (sessionPending) return;
    let mounted = true;
    void loadPrefs(userId).then((loaded) => {
      if (!mounted) return;
      setPrefs(loaded);
      setPrefsLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [userId, sessionPending]);

  function changePrefs(next: ReaderPrefs) {
    setPrefs(next);
    savePrefs(userId, next).catch((e) => console.warn("[reader] save prefs failed:", e));
    readerRef.current?.applySettings(prefsToSettings(next));
  }

  return { prefs, prefsLoaded, changePrefs };
}
