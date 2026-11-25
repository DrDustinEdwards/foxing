import { useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { AppState } from "react-native";
import { decodeLocator } from "@/components/reader/readium-helpers";
import type { useReaderWrites } from "@/lib/reader-data";

// Position and reading stretches are queued on the device (they survive a crash
// or no signal) through refs, so the timers always see the latest values. A stretch
// is logged every five minutes, when the app leaves the foreground, and on close;
// coming back to the front starts a new one.
export function useReadingProgress({
  book,
  userId,
  writes,
  setProgress,
  recordPosition,
}: {
  book: { id: string } | null;
  userId: string | null;
  writes: ReturnType<typeof useReaderWrites>;
  setProgress: Dispatch<SetStateAction<number>>;
  recordPosition: (cfi: string, progress: number) => void;
}) {
  const stretchStartRef = useRef<number>(0);
  const positionRef = useRef<{ cfi: string | null; percentage: number }>({
    cfi: null,
    percentage: 0,
  });
  const lastSaveRef = useRef<number>(0);
  const writesRef = useRef(writes);
  const lastLocationTimeRef = useRef<number>(0);
  const lastPageWordsRef = useRef<number>(0);
  const wpmSamplesRef = useRef<number[]>([]);
  const pagesReadRef = useRef<number>(0);
  // The set-interval / cleanup paths fire saveProgress on a stale closure
  // (book is null at first render). Route through a ref so they always
  // call the latest version that closes over the current `book`.
  const saveProgressRef = useRef<() => void>(() => {});

  useEffect(() => {
    startClocks();
    const t = setInterval(() => {
      saveProgressRef.current();
      logStretch();
    }, 5 * 60_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        stretchStartRef.current = Date.now();
        return;
      }
      saveProgressRef.current();
      logStretch();
    });
    return () => {
      clearInterval(t);
      sub.remove();
      saveProgressRef.current();
      logStretch();
    };
  }, []);

  function startClocks() {
    const now = Date.now();
    stretchStartRef.current = now;
    lastSaveRef.current = now;
    lastLocationTimeRef.current = now;
  }

  function saveProgress() {
    if (!book || !userId || !positionRef.current.cfi) return;
    const locator = decodeLocator(positionRef.current.cfi);
    if (!locator) return;
    writesRef.current.saveBook({
      progress: locator as unknown as Record<string, unknown>,
      progressPct: Math.round(positionRef.current.percentage * 1000) / 10,
    });
  }

  useLayoutEffect(() => {
    writesRef.current = writes;
    saveProgressRef.current = saveProgress;
  });

  // Logs the stretch since the last one as a reading session (sessions are append-only,
  // and the server counts the day toward the streak). Reads refs only, so the
  // mount-effect timers can call it. A stretch with no page turns is not reading.
  function logStretch() {
    const startedAt = stretchStartRef.current;
    const pagesRead = pagesReadRef.current;
    stretchStartRef.current = Date.now();
    pagesReadRef.current = 0;
    if (pagesRead === 0) return;
    const samples = wpmSamplesRef.current;
    writesRef.current.logSession({
      startedAt,
      endedAt: Date.now(),
      pagesRead,
      avgWpm:
        samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null,
      lastWpm: samples.length > 0 ? Math.round(samples[samples.length - 1]) : null,
    });
  }

  function onLocation(cfi: string, percentage: number, pageWordCount?: number) {
    positionRef.current = { cfi, percentage };
    setProgress(percentage);
    // The wrapper suppresses the initial relocate and debounces bursts, so
    // every call here is a real navigation the heartbeat can count.
    pagesReadRef.current += 1;

    recordPosition(cfi, percentage);

    const now = Date.now();
    const prevWords = lastPageWordsRef.current;
    const elapsedSec = (now - lastLocationTimeRef.current) / 1000;
    if (prevWords > 0 && elapsedSec > 5 && elapsedSec < 600) {
      const sample = (prevWords / elapsedSec) * 60;
      if (sample > 30 && sample < 1500) {
        wpmSamplesRef.current = [...wpmSamplesRef.current.slice(-4), sample];
        const avg = wpmSamplesRef.current.reduce((a, b) => a + b, 0) / wpmSamplesRef.current.length;
        const rounded = Math.round(avg);
        import("@/lib/user-prefs").then((m) => m.setCalibratedWpm(rounded)).catch(() => {});
      }
    }
    lastLocationTimeRef.current = now;
    if (pageWordCount && pageWordCount > 0) lastPageWordsRef.current = pageWordCount;

    if (Date.now() - lastSaveRef.current >= 5000) {
      lastSaveRef.current = Date.now();
      saveProgress();
    }
  }

  return { positionRef, saveProgressRef, onLocation };
}
