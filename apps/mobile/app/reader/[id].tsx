import { useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReaderTopBar } from "@/components/reader/reader-top-bar";
import { ReaderBottomBar } from "@/components/reader/reader-bottom-bar";
import {
  ReaderLoadOverlays,
  ReaderMissingBook,
  ReaderPending,
} from "@/components/reader/reader-load-overlays";
import { useOpenReaderBook } from "@/components/reader/use-open-reader-book";
import { ReaderAiSheets } from "@/components/reader/reader-ai-sheets";
import { ReaderNavSheets } from "@/components/reader/reader-nav-sheets";
import { useSleepTimer } from "@/components/reader/use-sleep-timer";
import { usePositionHistory } from "@/components/reader/use-position-history";
import { useReadingProgress } from "@/components/reader/use-reading-progress";
import { useReaderBookmarks } from "@/components/reader/use-reader-bookmarks";
import { useReaderPrefs } from "@/components/reader/use-reader-prefs";
import { useReaderChrome } from "@/components/reader/use-reader-chrome";
import { useReaderPill } from "@/components/reader/use-reader-pill";
import { useReaderLayerSync } from "@/components/reader/use-reader-layer-sync";
import { useColors } from "@/constants/colors";
import type { ReaderRect, ReaderRef, ReaderSettings } from "@/components/reader/reader-types";
import { ReadiumReader } from "@/components/reader/readium-reader";
import { PassageCommentSheet } from "@/components/reader/passage-comment-sheet";
import { TypographySheet } from "@/components/reader/typography-sheet";
import {
  type CompanionTool,
  MenuSheet,
  type MenuAction,
  type MenuInitialView,
} from "@/components/reader/menu-sheet";
import { ClubPanelSheet } from "@/components/reader/club-panel-sheet";
import { UpgradeSheet } from "@/components/reader/upgrade-sheet";
import { FloatingPill } from "@/components/reader/floating-pill";
import { authClient } from "@/lib/api";
import { useReaderWrites } from "@/lib/reader-data";
import { useBookAnnotations, useClubLive, useMe, useMyBook, useReaderPage } from "@foxing/client";
import { decodeLocator, encodeLocator } from "@/components/reader/readium-helpers";
import { BookmarkNamingModal, ReaderToast } from "@/components/reader/reader-overlays";
import {
  CANVAS_PALETTE,
  hexToRgba,
  prefsToSettings,
} from "@/components/reader/reader-screen-helpers";

export default function Reader() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;
  const readerRef = useRef<ReaderRef>(null);

  const readerPage = useReaderPage(id ?? "");
  const book = readerPage.data?.book ?? null;
  const session = authClient.useSession();
  const userId = session.data?.user.id ?? null;
  const me = useMe(undefined, !!userId);
  const myBook = useMyBook(book?.id ?? "", undefined, !!userId && !!book);
  const layers = useBookAnnotations(book?.id ?? "");
  const writes = useReaderWrites(book?.id ?? null);
  const isPdf = !!book && /\.pdf(\?|#|$)/i.test(book.epubUrl);
  const [readerState, setReaderState] = useState<"loading" | "ready" | "error">("loading");
  const [readerError, setReaderError] = useState<string | null>(null);
  const { chrome, toggleChrome } = useReaderChrome(readerState === "ready");

  const { prefs, prefsLoaded, changePrefs } = useReaderPrefs(userId, session.isPending, readerRef);
  // Unknown tier (still loading) does not block; the server is the authoritative gate.
  const subscriptionTier = me.data?.profile?.subscriptionTier ?? null;
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const locked = subscriptionTier === "free";
  const [showSettings, setShowSettings] = useState(false);

  const [currentChapter, setCurrentChapter] = useState({ title: "", index: 0 });
  const [progress, setProgress] = useState(0);
  const initialCfi = useOpenReaderBook({ readerPage, myBook, userId, writes, setProgress });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialView, setMenuInitialView] = useState<MenuInitialView>("secondary");
  const [clubPanelOpen, setClubPanelOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [companionTool, setCompanionTool] = useState<CompanionTool | null>(null);
  const [findQuery, setFindQuery] = useState("");
  const [findSubmitted, setFindSubmitted] = useState<string | null>(null);
  const previousChapterRef = useRef<string | null>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [goToOpen, setGoToOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const {
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
  } = useReaderPill({
    book,
    userId,
    writes,
    readerRef,
    chapterTitle: currentChapter.title,
    setToast,
  });

  const matchingClubs = readerPage.data?.shareableClubs ?? [];

  const [commentSheet, setCommentSheet] = useState<{
    cfi: string;
    passageText: string;
  } | null>(null);

  const live = useClubLive(matchingClubs[0]?.id ?? null);
  const presence = live.presence.filter((u) => u !== userId);

  const { positionHistoryRef, swipeResponder, recordPosition } = usePositionHistory(
    book,
    readerRef,
  );
  const { positionRef, saveProgressRef, onLocation } = useReadingProgress({
    book,
    userId,
    writes,
    setProgress,
    recordPosition: (cfi, percentage) =>
      recordPosition(cfi, currentChapter.title || null, percentage),
  });
  const { isCurrentBookmarked, bookmarkPrompt, setBookmarkPrompt, onBookmarkTap } =
    useReaderBookmarks({
      book,
      writes,
      positionRef,
      chapterTitle: currentChapter.title,
      progress,
      setToast,
    });
  const {
    sleepSheetOpen,
    setSleepSheetOpen,
    sleepTimer,
    sleepRemainingMs,
    expireSleepTimer,
    onPickSleepOption,
  } = useSleepTimer(saveProgressRef, setToast);

  useReaderLayerSync({
    readerRef,
    ready: readerState === "ready",
    layers,
    popularEnabled: prefs.popularHighlightsEnabled,
  });

  function handleMenuAction(action: MenuAction) {
    setMenuOpen(false);
    switch (action) {
      case "ask-chat":
        setChatSeed(null);
        setChatOpen(true);
        break;
      case "character_map":
      case "book_insight":
      case "semantic_search":
      case "chapter_feature":
      case "deep_dive":
      case "discussion_starter":
        setFindQuery("");
        setFindSubmitted(null);
        setCompanionTool(action);
        break;
      case "highlights":
        setHighlightsOpen(true);
        break;
      case "vocabulary":
        // Full-screen route. Pre-filter to this book. Cast: Expo Router's
        // generated route types only refresh when Metro runs, on a cold
        // tsc the new file isn't known yet.
        if (book) router.push(`/vocabulary?bookId=${book.id}` as never);
        break;
      case "quote-card":
        if (book) {
          router.push(
            `/quote-card?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}` as never,
          );
        }
        break;
      case "my-clubs":
        // First matching club only.
        if (matchingClubs.length > 0) {
          router.push(`/clubs/${matchingClubs[0].id}` as never);
        }
        break;
      case "listen":
        void (async () => {
          try {
            const text = await (readerRef.current?.getChapterText?.() ?? Promise.resolve(""));
            setTtsText(text ?? "");
            setTtsOpen(true);
          } catch (e) {
            console.warn("[reader] getChapterText failed:", e instanceof Error ? e.message : e);
            setToast("Couldn't load this chapter's text for Listen.");
          }
        })();
        break;
      case "sleep-timer":
        setSleepSheetOpen(true);
        break;
    }
  }

  if (readerPage.isPending || !prefsLoaded) return <ReaderPending />;

  if (!book) return <ReaderMissingBook onBack={() => router.back()} />;

  const themeColors = CANVAS_PALETTE[prefs.canvasTheme];
  const initialSettings: ReaderSettings = prefsToSettings(prefs);

  // Mapped to existing tokens so dark mode keeps adapting.
  const chromeBg = hexToRgba(colors.bgBase, 0.95);

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: themeColors.background }}
      {...swipeResponder.panHandlers}
    >
      <ReadiumReader
        ref={readerRef}
        epubUrl={book.epubUrl}
        initialCfi={initialCfi ?? undefined}
        initialSettings={initialSettings}
        onReady={() => {
          setReaderState("ready");
          setReaderError(null);
        }}
        onError={(message) => {
          console.log("[reader] error", message);
          setReaderState("error");
          setReaderError(message);
        }}
        onLocationChange={onLocation}
        onChapterChange={(c) => {
          const prevTitle = previousChapterRef.current;
          const isRealTransition = !!prevTitle && prevTitle !== c.title;
          if (isRealTransition) {
            // Wait for the state update so the new chapter shows before we save and navigate.
            if (sleepTimer?.kind === "end_of_chapter") {
              void expireSleepTimer();
            }
          }
          previousChapterRef.current = c.title;
          setCurrentChapter({ title: c.title, index: 0 });
        }}
        onWordTapped={(word, surroundingText, cfi, rect: ReaderRect) => {
          // PDF mode: foliate's word boundaries are unreliable, so suppress
          // the tap pill entirely and just toggle chrome.
          if (isPdf) {
            toggleChrome();
            return;
          }
          console.log("[reader] word tap", { word, rect });
          showWordPill({ word, surroundingText, cfi }, rect);
        }}
        onPassageSelected={(text, cfi, rect: ReaderRect) => {
          console.log("[reader] passage select", { chars: text.length, rect });
          showPassagePill({ text, cfi }, rect);
        }}
        onTap={() => {
          if (pillMode) {
            dismissPill();
          } else {
            toggleChrome();
          }
        }}
        onPassageCommentTapped={(cfi, passageText) => {
          if (!cfi) return;
          setCommentSheet({ cfi, passageText });
        }}
      />
      <ReaderLoadOverlays
        readerState={readerState}
        readerError={readerError}
        themeColors={themeColors}
        onBack={() => router.back()}
      />

      {/* TOP CHROME BAR, Back · title · Aa · ☰ · bookmark. rgba background
          (not the opacity prop) keeps icons + text fully opaque while the
          bar itself stays semi-translucent. Border-bottom separates it
          from the canvas regardless of how close the colors are. */}
      {chrome ? (
        <ReaderTopBar
          chromeBg={chromeBg}
          isTablet={isTablet}
          bookTitle={book.title}
          chapterTitle={currentChapter.title}
          isCurrentBookmarked={isCurrentBookmarked}
          onBack={() => router.back()}
          onOpenGoTo={() => setGoToOpen(true)}
          onOpenSettings={() => setShowSettings(true)}
          onBookmarkTap={onBookmarkTap}
        />
      ) : null}

      {chrome ? (
        <ReaderBottomBar
          chromeBg={chromeBg}
          isTablet={isTablet}
          progress={progress}
          chapterTitle={currentChapter.title}
          clubName={matchingClubs[0]?.name ?? null}
          presenceCount={presence.length}
          sleepTimer={sleepTimer}
          sleepRemainingMs={sleepRemainingMs}
          isPdf={isPdf}
          onJump={(fraction) => readerRef.current?.jumpToProgress(fraction)}
          onOpenClub={() => setClubPanelOpen(true)}
          onOpenMenu={(view) => {
            setMenuInitialView(view);
            setMenuOpen(true);
          }}
        />
      ) : null}

      {/* Floating pill rendered AFTER chrome so it sits on top, when the
          pill is anchored near the top or bottom of the screen, it can't
          be hidden behind the chrome bar. */}
      <FloatingPill
        visible={pillMode !== null}
        mode={pillMode ?? "word"}
        anchor={pillAnchor}
        onDismiss={dismissPill}
        onLookup={handleLookup}
        onAnalyze={handleAnalyze}
        onAsk={handleAsk}
        onTranslate={handleTranslate}
        locked={locked}
        onUpgrade={(feature) => setUpgradeFeature(feature)}
        showClub={matchingClubs.length > 0}
        onClub={() => {
          if (!passagePayload?.cfi) {
            setToast("Selection needs a position, try selecting again.");
            dismissPill();
            return;
          }
          setCommentSheet({
            cfi: passagePayload.cfi,
            passageText: passagePayload.text,
          });
          dismissPill();
        }}
        onHighlight={handleHighlight}
      />

      <ReaderToast message={toast} onHide={() => setToast(null)} />

      <TypographySheet
        visible={showSettings}
        prefs={prefs}
        userId={userId}
        bookId={book.id}
        sidePanel={isTablet}
        onChangePrefs={changePrefs}
        onClose={() => setShowSettings(false)}
      />

      <ReaderAiSheets
        bookId={book.id}
        bookTitle={book.title}
        chapterTitle={currentChapter.title}
        targetLanguage={prefs.targetLanguage}
        writes={writes}
        wordSheet={wordSheet}
        onCloseWord={() => setWordSheet(null)}
        passageSheet={passageSheet}
        onClosePassage={() => setPassageSheet(null)}
        chatOpen={chatOpen}
        chatSeed={chatSeed}
        onCloseChat={() => {
          setChatOpen(false);
          setChatSeed(null);
        }}
        companionTool={companionTool}
        onCloseTool={() => setCompanionTool(null)}
        findQuery={findQuery}
        setFindQuery={setFindQuery}
        findSubmitted={findSubmitted}
        setFindSubmitted={setFindSubmitted}
        translateText={translateText}
        onCloseTranslate={() => setTranslateText(null)}
      />

      <MenuSheet
        visible={menuOpen}
        bookTitle={book.title}
        bookAuthor={book.author}
        currentChapterTitle={currentChapter.title}
        initialView={menuInitialView}
        clubsReadingThis={matchingClubs}
        onAction={handleMenuAction}
        locked={locked}
        onUpgrade={(feature) => setUpgradeFeature(feature)}
        onClose={() => setMenuOpen(false)}
      />

      {matchingClubs.length > 0 ? (
        <ClubPanelSheet
          visible={clubPanelOpen}
          club={matchingClubs[0]}
          bookId={book.id}
          bookTitle={book.title}
          onOpenComment={(c) => {
            if (c.locator) setCommentSheet({ cfi: encodeLocator(c.locator), passageText: "" });
            setClubPanelOpen(false);
          }}
          onClose={() => setClubPanelOpen(false)}
        />
      ) : null}

      <UpgradeSheet
        visible={upgradeFeature !== null}
        feature={upgradeFeature ?? undefined}
        onClose={() => setUpgradeFeature(null)}
      />

      {commentSheet ? (
        <PassageCommentSheet
          visible
          bookId={book.id}
          cfi={commentSheet.cfi}
          passageText={commentSheet.passageText}
          clubs={matchingClubs}
          onClose={() => setCommentSheet(null)}
        />
      ) : null}

      <ReaderNavSheets
        readerRef={readerRef}
        positionHistoryRef={positionHistoryRef}
        bookId={book.id}
        bookTitle={book.title}
        bookAuthor={book.author}
        progress={progress}
        highlightsOpen={highlightsOpen}
        onCloseHighlights={() => setHighlightsOpen(false)}
        sleepSheetOpen={sleepSheetOpen}
        sleepTimer={sleepTimer}
        onPickSleepOption={onPickSleepOption}
        onCloseSleep={() => setSleepSheetOpen(false)}
        goToOpen={goToOpen}
        onCloseGoTo={() => setGoToOpen(false)}
        ttsOpen={ttsOpen}
        ttsText={ttsText}
        onCloseTts={() => setTtsOpen(false)}
      />

      {bookmarkPrompt ? (
        <BookmarkNamingModal
          suggested={bookmarkPrompt.suggestedName}
          onCancel={() => setBookmarkPrompt(null)}
          onSave={(name) => {
            writes.addAnnotation({
              type: "bookmark",
              locator: decodeLocator(bookmarkPrompt.cfi) as unknown as Record<string, unknown>,
              body: name || bookmarkPrompt.suggestedName,
              chapter: currentChapter.title || null,
            });
            setToast("Bookmark saved.");
            setBookmarkPrompt(null);
          }}
        />
      ) : null}
    </View>
  );
}
