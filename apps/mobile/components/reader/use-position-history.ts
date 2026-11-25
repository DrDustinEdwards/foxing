import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { PanResponder } from "react-native";
import type { ReaderRef } from "@/components/reader/reader-types";
import { haptic } from "@/lib/haptics";
import {
  appendEntry as appendHistoryEntry,
  loadHistory as loadPositionHistory,
  saveHistory as savePositionHistory,
  type PositionEntry,
} from "@/lib/position-history";

// The responder closes over this holder so the swipe-back handler always reads
// the latest state without re-creating the responder on every render.
function createSwipeResponder() {
  const swipeBack = { current: () => {} };
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      const startX = evt.nativeEvent.pageX - gestureState.dx;
      const leftSwipeRight =
        startX < 32 &&
        gestureState.dx > 36 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      return leftSwipeRight;
    },
    onPanResponderGrant: (evt, gestureState) => {
      const startX = evt.nativeEvent.pageX - gestureState.dx;
      if (startX < 32 && gestureState.dx > 36) {
        swipeBack.current();
      }
    },
  });
  return {
    responder,
    setSwipeBack: (fn: () => void) => {
      swipeBack.current = fn;
    },
  };
}

// Position history, last 50 unique CFIs per book, persisted to AsyncStorage.
// We hold the canonical copy in a ref so onLocation can mutate without
// re-rendering on every page turn; saves are debounced via a separate ref.
export function usePositionHistory(
  book: { id: string } | null,
  readerRef: RefObject<ReaderRef | null>,
) {
  const positionHistoryRef = useRef<PositionEntry[]>([]);
  const historySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [swipe] = useState(createSwipeResponder);

  // The ref is the source of truth mid-session; a debounced save mirrors it to AsyncStorage.
  useEffect(() => {
    if (!book) return;
    let mounted = true;
    void loadPositionHistory(book.id).then((rows) => {
      if (mounted) positionHistoryRef.current = rows;
    });
    return () => {
      mounted = false;
    };
  }, [book]);

  useEffect(
    () => () => {
      if (historySaveTimerRef.current) clearTimeout(historySaveTimerRef.current);
      const b = book;
      if (b) savePositionHistory(b.id, positionHistoryRef.current).catch(() => {});
    },
    [book],
  );

  // onLocation's append collapses consecutive same-CFI entries, so the destination refreshes in place.
  const onSwipeBack = useCallback(() => {
    const history = positionHistoryRef.current;
    if (history.length < 2 || !book) return;
    const next = history.slice(0, -1);
    positionHistoryRef.current = next;
    savePositionHistory(book.id, next).catch(() => {});
    const target = next[next.length - 1];
    readerRef.current?.goTo(target.cfi);
    haptic.light();
  }, [book, readerRef]);
  useLayoutEffect(() => {
    swipe.setSwipeBack(onSwipeBack);
  }, [onSwipeBack, swipe]);

  function recordPosition(cfi: string, chapter: string | null, progress: number) {
    if (!book || !cfi) return;
    positionHistoryRef.current = appendHistoryEntry(positionHistoryRef.current, {
      cfi,
      chapter,
      timestamp: Date.now(),
      progress,
    });
    if (historySaveTimerRef.current) clearTimeout(historySaveTimerRef.current);
    const bookId = book.id;
    historySaveTimerRef.current = setTimeout(() => {
      savePositionHistory(bookId, positionHistoryRef.current).catch(() => {});
    }, 2000);
  }

  return { positionHistoryRef, swipeResponder: swipe.responder, recordPosition };
}
