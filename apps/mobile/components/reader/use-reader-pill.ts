import { useState, type RefObject } from "react";
import { privacyToVisibility, type PrivacyTier } from "@/components/privacy-selector";
import type { HighlightColor, PillAnchor, PillMode } from "@/components/reader/floating-pill";
import { decodeLocator } from "@/components/reader/readium-helpers";
import type {
  PassagePillState,
  ReaderRect,
  ReaderRef,
  WordPillState,
} from "@/components/reader/reader-types";
import { haptic } from "@/lib/haptics";
import type { useReaderWrites } from "@/lib/reader-data";

// The selection pill (word or passage) and the sheets its actions open.
export function useReaderPill({
  book,
  userId,
  writes,
  readerRef,
  chapterTitle,
  setToast,
}: {
  book: { id: string } | null;
  userId: string | null;
  writes: ReturnType<typeof useReaderWrites>;
  readerRef: RefObject<ReaderRef | null>;
  chapterTitle: string;
  setToast: (message: string) => void;
}) {
  const [pillMode, setPillMode] = useState<PillMode | null>(null);
  const [pillAnchor, setPillAnchor] = useState<PillAnchor | null>(null);
  const [wordPayload, setWordPayload] = useState<WordPillState | null>(null);
  const [passagePayload, setPassagePayload] = useState<PassagePillState | null>(null);

  const [wordSheet, setWordSheet] = useState<WordPillState | null>(null);
  const [passageSheet, setPassageSheet] = useState<PassagePillState | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const [translateText, setTranslateText] = useState<string | null>(null);

  function dismissPill() {
    setPillMode(null);
    setPillAnchor(null);
    setWordPayload(null);
    setPassagePayload(null);
  }

  function showWordPill(payload: WordPillState, rect: ReaderRect) {
    setWordPayload(payload);
    setPassagePayload(null);
    setPillAnchor(rect);
    setPillMode("word");
    haptic.light();
  }

  function showPassagePill(payload: PassagePillState, rect: ReaderRect) {
    setPassagePayload(payload);
    setWordPayload(null);
    setPillAnchor(rect);
    setPillMode("passage");
    haptic.light();
  }

  function handleHighlight(color: HighlightColor, privacy: PrivacyTier = "public") {
    const cfi = (pillMode === "word" ? wordPayload?.cfi : passagePayload?.cfi) ?? null;
    const text = pillMode === "word" ? wordPayload?.word : passagePayload?.text;
    if (!cfi || !text || !book) {
      console.warn("[reader] highlight skipped, missing cfi/text/book", {
        hasCfi: !!cfi,
        hasText: !!text,
        hasBook: !!book,
        mode: pillMode,
      });
      if (!cfi && text && book) {
        setToast("Couldn't save highlight, try selecting again.");
      }
      dismissPill();
      return;
    }
    if (!userId) {
      dismissPill();
      return;
    }
    writes.addAnnotation({
      type: "highlight",
      locator: decodeLocator(cfi) as unknown as Record<string, unknown>,
      selectedText: text,
      color,
      chapter: chapterTitle || null,
      visibility: privacyToVisibility(privacy),
    });
    readerRef.current?.addHighlight(cfi, color);
    haptic.light();
    dismissPill();
  }

  function handleLookup() {
    if (!wordPayload) {
      dismissPill();
      return;
    }
    setWordSheet(wordPayload);
    dismissPill();
  }

  function handleAnalyze() {
    if (!passagePayload) {
      dismissPill();
      return;
    }
    setPassageSheet(passagePayload);
    dismissPill();
  }

  function handleAsk() {
    if (pillMode === "word" && wordPayload) {
      setChatSeed(`In "${wordPayload.surroundingText}", what does "${wordPayload.word}" mean? `);
      setChatOpen(true);
      dismissPill();
      return;
    }
    if (passagePayload) {
      setChatSeed(`About this passage: "${passagePayload.text}" `);
      setChatOpen(true);
      dismissPill();
      return;
    }
    dismissPill();
  }

  function handleTranslate() {
    const raw = pillMode === "word" ? wordPayload?.word : passagePayload?.text;
    if (raw) setTranslateText(raw);
    dismissPill();
  }

  return {
    pillMode,
    pillAnchor,
    passagePayload,
    dismissPill,
    showWordPill,
    showPassagePill,
    handleHighlight,
    handleLookup,
    handleAnalyze,
    handleAsk,
    handleTranslate,
    wordSheet,
    setWordSheet,
    passageSheet,
    setPassageSheet,
    chatOpen,
    setChatOpen,
    chatSeed,
    setChatSeed,
    translateText,
    setTranslateText,
  };
}
