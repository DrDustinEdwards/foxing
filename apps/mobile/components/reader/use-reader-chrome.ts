import { useCallback, useEffect, useRef, useState } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The top and bottom bars show on tap and hide themselves after three seconds.
export function useReaderChrome(ready: boolean) {
  const [chrome, setChrome] = useState(false);
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chromeTimerRef.current) {
      clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
    if (chrome) {
      chromeTimerRef.current = setTimeout(() => setChrome(false), 3000);
    }
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, [chrome]);

  const [wasReady, setWasReady] = useState(false);
  if (ready !== wasReady) {
    setWasReady(ready);
    if (ready) setChrome(true);
  }

  // Keep the screen awake while reading; the module reference-counts, so repeat calls are safe.
  useEffect(() => {
    let active = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem("reading_defaults");
        const prefs = raw ? (JSON.parse(raw) as { keepAwake?: boolean }) : null;
        if (prefs?.keepAwake !== true) return;
        await activateKeepAwakeAsync("foxing-reader");
        active = true;
      } catch {
        /* keep-awake unavailable, silently skip */
      }
    })();
    return () => {
      if (active) {
        try {
          void deactivateKeepAwake("foxing-reader");
        } catch {}
      }
    };
  }, []);

  const toggleChrome = useCallback(() => setChrome((v) => !v), []);

  return { chrome, toggleChrome };
}
