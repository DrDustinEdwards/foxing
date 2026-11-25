import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "expo-router";
import type { SleepTimerOption } from "@/components/reader/sleep-timer-sheet";

// Sleep timer, sheet visibility, active option, and remaining ms for the
// countdown badge. The interval handle lives in a ref so re-renders don't
// restart the timer; the deadline lives in a ref too so chrome can re-mount
// mid-countdown without losing the original target time.
export function useSleepTimer(
  saveProgressRef: RefObject<() => void>,
  setToast: (m: string) => void,
) {
  const router = useRouter();
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerOption | null>(null);
  const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepEndAtRef = useRef<number | null>(null);
  const sleepNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearSleepInterval() {
    if (sleepIntervalRef.current) {
      clearInterval(sleepIntervalRef.current);
      sleepIntervalRef.current = null;
    }
    sleepEndAtRef.current = null;
  }

  const expireSleepTimer = useCallback(async () => {
    clearSleepInterval();
    setSleepTimer(null);
    setSleepRemainingMs(null);
    try {
      saveProgressRef.current();
    } catch {}
    setToast("Your place is saved.");
    // Brief delay so the toast registers before the reader unmounts and
    // the library tab paints over it.
    sleepNavTimerRef.current = setTimeout(() => {
      router.replace("/(tabs)/library" as never);
    }, 1200);
  }, [router, saveProgressRef, setToast]);

  const onPickSleepOption = useCallback(
    (opt: SleepTimerOption) => {
      setSleepSheetOpen(false);
      clearSleepInterval();
      if (opt.kind === "cancel") {
        setSleepTimer(null);
        setSleepRemainingMs(null);
        return;
      }
      if (opt.kind === "end_of_chapter") {
        setSleepTimer(opt);
        setSleepRemainingMs(null);
        return;
      }
      const totalMs = opt.minutes * 60_000;
      const endAt = Date.now() + totalMs;
      sleepEndAtRef.current = endAt;
      setSleepTimer(opt);
      setSleepRemainingMs(totalMs);
      sleepIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, endAt - Date.now());
        setSleepRemainingMs(remaining);
        if (remaining <= 0) {
          void expireSleepTimer();
        }
      }, 1000);
    },
    [expireSleepTimer],
  );

  useEffect(
    () => () => {
      clearSleepInterval();
      if (sleepNavTimerRef.current) clearTimeout(sleepNavTimerRef.current);
    },
    [],
  );

  return {
    sleepSheetOpen,
    setSleepSheetOpen,
    sleepTimer,
    sleepRemainingMs,
    expireSleepTimer,
    onPickSleepOption,
  };
}
