import type { RefObject } from "react";
import { GoToSheet } from "@/components/reader/go-to-sheet";
import { HighlightsSheet } from "@/components/reader/highlights-sheet";
import type { ReaderRef } from "@/components/reader/reader-types";
import { SleepTimerSheet, type SleepTimerOption } from "@/components/reader/sleep-timer-sheet";
import { TtsBar } from "@/components/reader/tts-bar";
import { clearHistory as clearPositionHistory, type PositionEntry } from "@/lib/position-history";

export function ReaderNavSheets({
  readerRef,
  positionHistoryRef,
  bookId,
  bookTitle,
  bookAuthor,
  progress,
  highlightsOpen,
  onCloseHighlights,
  sleepSheetOpen,
  sleepTimer,
  onPickSleepOption,
  onCloseSleep,
  goToOpen,
  onCloseGoTo,
  ttsOpen,
  ttsText,
  onCloseTts,
}: {
  readerRef: RefObject<ReaderRef | null>;
  positionHistoryRef: RefObject<PositionEntry[]>;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  progress: number;
  highlightsOpen: boolean;
  onCloseHighlights: () => void;
  sleepSheetOpen: boolean;
  sleepTimer: SleepTimerOption | null;
  onPickSleepOption: (opt: SleepTimerOption) => void;
  onCloseSleep: () => void;
  goToOpen: boolean;
  onCloseGoTo: () => void;
  ttsOpen: boolean;
  ttsText: string;
  onCloseTts: () => void;
}) {
  return (
    <>
      <HighlightsSheet
        visible={highlightsOpen}
        bookTitle={bookTitle}
        bookAuthor={bookAuthor}
        bookId={bookId}
        onNavigate={(cfi) => readerRef.current?.goTo(cfi)}
        onClose={() => onCloseHighlights()}
      />

      <SleepTimerSheet
        visible={sleepSheetOpen}
        active={sleepTimer}
        onPick={onPickSleepOption}
        onClose={() => onCloseSleep()}
      />

      <GoToSheet
        visible={goToOpen}
        bookId={bookId}
        currentProgress={progress}
        loadToc={() =>
          (readerRef.current?.getToc?.() ?? Promise.resolve([])).then((items) =>
            (items ?? []).map((it) => ({ label: it.label, href: it.href, cfi: it.cfi })),
          )
        }
        loadHistory={() => Promise.resolve(positionHistoryRef.current)}
        onClearHistory={async () => {
          positionHistoryRef.current = [];
          await clearPositionHistory(bookId);
        }}
        onNavigateCfi={(cfi) => readerRef.current?.goTo(cfi)}
        onNavigatePercent={(p) => readerRef.current?.jumpToProgress(p)}
        onNavigateHref={(href) => {
          readerRef.current?.goTo(href);
        }}
        onClose={() => onCloseGoTo()}
      />

      <TtsBar
        visible={ttsOpen}
        chapterText={ttsText}
        onCurrentSentence={(index) => {
          readerRef.current?.highlightSentence(index);
        }}
        onClose={() => {
          onCloseTts();
          readerRef.current?.highlightSentence(null);
        }}
      />
    </>
  );
}
