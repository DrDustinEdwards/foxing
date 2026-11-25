import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { encodeLocator } from "@/components/reader/readium-helpers";
import type { useReaderWrites } from "@/lib/reader-data";
import type { useMyBook, useReaderPage } from "@foxing/client";

// Once the book loads: open at the saved place, and put the book on the Reading shelf
// if it isn't there yet (finished and paused books stay where they are, so opening
// a finished book to look something up doesn't bounce it back).
export function useOpenReaderBook({
  readerPage,
  myBook,
  userId,
  writes,
  setProgress,
}: {
  readerPage: ReturnType<typeof useReaderPage>;
  myBook: ReturnType<typeof useMyBook>;
  userId: string | null;
  writes: ReturnType<typeof useReaderWrites>;
  setProgress: Dispatch<SetStateAction<number>>;
}) {
  const [initialCfi, setInitialCfi] = useState<string | null>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (!readerPage.data || opened.current) return;
    if (userId && myBook.isPending) return;
    opened.current = true;
    const saved = readerPage.data.initialLocator;
    // oxlint-disable-next-line react/set-state-in-effect -- one-time seed once the book and shelf entry have loaded
    if (saved) setInitialCfi(encodeLocator(saved));
    if (myBook.data?.progressPct) setProgress(myBook.data.progressPct / 100);
    const status = myBook.data?.status ?? null;
    if (userId && (!status || status === "want" || status === "abandoned")) {
      writes.saveBook({
        status: "reading",
        ...(myBook.data?.startedAt ? {} : { startedAt: Date.now() }),
      });
    }
  }, [readerPage.data, userId, myBook.isPending, myBook.data, writes, setProgress]);
  return initialCfi;
}
