import { useCallback, useMemo, useState, type RefObject } from "react";
import { haptic } from "@/lib/haptics";
import { useBookmarks, type useReaderWrites } from "@/lib/reader-data";

export function useReaderBookmarks({
  book,
  writes,
  positionRef,
  chapterTitle,
  progress,
  setToast,
}: {
  book: { id: string } | null;
  writes: ReturnType<typeof useReaderWrites>;
  positionRef: RefObject<{ cfi: string | null; percentage: number }>;
  chapterTitle: string;
  progress: number;
  setToast: (message: string) => void;
}) {
  const { bookmarks } = useBookmarks(book?.id ?? null);
  const bookmarkCfis = useMemo(() => new Set(bookmarks.map((b) => b.cfi)), [bookmarks]);
  const [bookmarkPrompt, setBookmarkPrompt] = useState<{
    cfi: string;
    suggestedName: string;
  } | null>(null);
  const isCurrentBookmarked = useMemo(
    () => !!(positionRef.current.cfi && bookmarkCfis.has(positionRef.current.cfi)),
    // oxlint-disable-next-line react/exhaustive-deps -- re-evaluate when progress changes, since positionRef is a ref
    [bookmarkCfis, progress],
  );

  const onBookmarkTap = useCallback(() => {
    const cfi = positionRef.current.cfi;
    if (!cfi || !book) {
      setToast("Couldn't read the current position. Try turning the page.");
      return;
    }
    const existing = bookmarks.find((b) => b.cfi === cfi);
    if (existing) {
      writes.removeAnnotation(existing.id);
      setToast("Bookmark removed.");
      return;
    }
    haptic.light();
    const suggested = `${chapterTitle || "Bookmark"} · ${Math.round(progress * 100)}%`;
    setBookmarkPrompt({ cfi, suggestedName: suggested });
  }, [book, bookmarks, writes, chapterTitle, progress, positionRef, setToast]);

  return { isCurrentBookmarked, bookmarkPrompt, setBookmarkPrompt, onBookmarkTap };
}
