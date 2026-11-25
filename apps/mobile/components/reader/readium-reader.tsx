import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, useWindowDimensions } from "react-native";
import { ensureEpubLocalUri } from "@/lib/epub-cache";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  ReadiumView,
  type ReadiumViewRef,
  type Locator,
  type Preferences,
  type DecorationGroup,
  type Decoration,
  type SelectionAction,
  type SelectionEvent,
  type PublicationReadyEvent,
  type DecorationActivatedEvent,
} from "react-native-readium";

import type { HighlightColor } from "@/components/reader/floating-pill";
import type {
  ReaderRef,
  ReaderSettings,
  PassageCommentMarker,
  ReaderRect,
} from "@/components/reader/reader-types";
import { getChapterContent } from "@/lib/epub-content";
import {
  decodeLocator,
  encodeLocator,
  settingsToReadiumPreferences,
  splitSentences,
  toSoftTint,
} from "./readium-helpers";

const HIGHLIGHTS_GROUP = "highlights";
const TTS_SENTENCE_GROUP = "tts-sentence";
const PASSAGE_COMMENT_GROUP = "passage-comment-markers";
const POPULAR_HIGHLIGHTS_GROUP = "popular-highlights";

interface ReadiumReaderProps {
  epubUrl: string;
  initialCfi?: string;
  initialSettings: ReaderSettings;
  onReady?: () => void;
  onError?: (message: string) => void;
  onLocationChange?: (
    cfi: string,
    fraction: number,
    pageWordCount?: number,
    pageText?: string,
  ) => void;
  onChapterChange?: (chapter: { title: string; index: number }) => void;
  onWordTapped?: (
    word: string,
    surroundingText: string,
    cfi: string | null,
    rect: ReaderRect,
  ) => void;
  onPassageSelected?: (text: string, cfi: string | null, rect: ReaderRect) => void;
  onTap?: () => void;
  onPassageCommentTapped?: (cfi: string | null, passageText: string) => void;
}

export const ReadiumReader = forwardRef<ReaderRef, ReadiumReaderProps>(function ReadiumReader(
  {
    epubUrl,
    initialCfi,
    initialSettings,
    onReady,
    onError,
    onLocationChange,
    onChapterChange,
    onWordTapped,
    onPassageSelected,
    onTap,
    onPassageCommentTapped,
  },
  ref,
) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const viewRef = useRef<ReadiumViewRef>(null);
  const [highlights, setHighlights] = useState<Decoration[]>([]);
  const [sentenceDecoration, setSentenceDecoration] = useState<Decoration | null>(null);
  const [readiumPrefs, setReadiumPrefs] = useState<Preferences>(() =>
    settingsToReadiumPreferences(initialSettings),
  );
  // The Kotlin navigator's text locator search only covers the rendered chapter, so decorations are re-derived against the active chapter href.
  const [commentMarkers, setCommentMarkers] = useState<PassageCommentMarker[]>([]);
  const commentMarkersRef = useRef<PassageCommentMarker[]>([]);
  const highlightColorKeysRef = useRef(new Map<string, HighlightColor>());
  const [commentColor, setCommentColor] = useState<string>("#A33B20");
  const [popularMarkers, setPopularMarkers] = useState<
    Array<{ text?: string; cfi: string; count: number }>
  >([]);
  const [popularColor, setPopularColor] = useState<string>("#9E9E9E");
  // State form of the Locator href so decoration memos rebuild; currentLocatorRef stays the source for non-render reads.
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  // Readium cannot open an HTTPS URL (the native side silently stays loading), so download first and mount ReadiumView once the file is local.
  const [localUri, setLocalUri] = useState<string | null>(null);

  // Mirror host callbacks through refs: their identity changes every render, and a re-fired download effect would remount ReadiumView at initialLocation (chapter 1 with no saved position).
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onLocationChangeRef = useRef(onLocationChange);
  const onChapterChangeRef = useRef(onChapterChange);
  const onWordTappedRef = useRef(onWordTapped);
  const onPassageSelectedRef = useRef(onPassageSelected);
  const onPassageCommentTappedRef = useRef(onPassageCommentTapped);
  const onTapRef = useRef(onTap);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onLocationChangeRef.current = onLocationChange;
  onChapterChangeRef.current = onChapterChange;
  onWordTappedRef.current = onWordTapped;
  onPassageSelectedRef.current = onPassageSelected;
  onPassageCommentTappedRef.current = onPassageCommentTapped;
  onTapRef.current = onTap;

  // Single-shot onReady; handleLocationChange is a fallback for builds where publication-ready never reaches us. Never reset: resetting on host re-renders caused the jump to chapter 1.
  const readyFiredRef = useRef(false);
  const fireReadyOnce = useCallback(() => {
    if (readyFiredRef.current) return;
    readyFiredRef.current = true;
    onReadyRef.current?.();
  }, []);
  const highlightPaletteRef = useRef<Record<HighlightColor, string>>({
    amber: "#FFC107",
    auburn: "#A33B20",
    yellow: "#FFEB3B",
    sage: "#9CCC65",
    cobalt: "#3B5BDB",
    crimson: "#D32F2F",
    purple: "#9C27B0",
  });
  const lastSavedLocatorRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLocatorRef = useRef<Locator | null>(null);
  const tocRef = useRef<Array<{ label: string; href: string; cfi: string | null }>>([]);
  const chapterSentencesRef = useRef<string[]>([]);
  const positionsRef = useRef<Locator[]>([]);

  const initialLocator = useMemo(() => decodeLocator(initialCfi), [initialCfi]);

  // Text-based locators only paint when the comment's chapter is rendered; the memo recomputes when currentHref changes.
  const passageCommentDecorations: Decoration[] = useMemo(() => {
    if (!currentHref || commentMarkers.length === 0) return [];
    const type = currentLocatorRef.current?.type ?? "application/xhtml+xml";
    return commentMarkers.map((m, i) => ({
      id: `pc-${i}-${m.passageText.length}`,
      locator: {
        href: currentHref,
        type,
        text: { highlight: m.passageText.slice(0, 200) },
      },
      style: {
        type: "underline",
        tint: commentColor,
      },
    }));
  }, [commentMarkers, commentColor, currentHref]);

  const popularHighlightDecorations: Decoration[] = useMemo(() => {
    if (!currentHref || popularMarkers.length === 0) return [];
    const type = currentLocatorRef.current?.type ?? "application/xhtml+xml";
    const softTint = toSoftTint(popularColor);
    return popularMarkers
      .filter((m) => m.text && m.text.trim().length > 0)
      .map((m, i) => ({
        id: `ph-${i}-${m.text?.length ?? 0}`,
        locator: {
          href: currentHref,
          type,
          text: { highlight: (m.text ?? "").slice(0, 200) },
        },
        style: {
          type: "highlight",
          tint: softTint,
        },
      }));
  }, [popularMarkers, popularColor, currentHref]);

  const decorations: DecorationGroup[] = useMemo(() => {
    const groups: DecorationGroup[] = [{ name: HIGHLIGHTS_GROUP, decorations: highlights }];
    if (popularHighlightDecorations.length > 0) {
      groups.push({
        name: POPULAR_HIGHLIGHTS_GROUP,
        decorations: popularHighlightDecorations,
      });
    }
    if (passageCommentDecorations.length > 0) {
      groups.push({
        name: PASSAGE_COMMENT_GROUP,
        decorations: passageCommentDecorations,
      });
    }
    if (sentenceDecoration) {
      groups.push({ name: TTS_SENTENCE_GROUP, decorations: [sentenceDecoration] });
    }
    return groups;
  }, [highlights, popularHighlightDecorations, passageCommentDecorations, sentenceDecoration]);

  const flushLocator = useCallback((locator: Locator) => {
    const serialized = encodeLocator(locator);
    if (serialized === lastSavedLocatorRef.current) return;
    lastSavedLocatorRef.current = serialized;
    const progression = locator.locations?.totalProgression ?? 0;
    onLocationChangeRef.current?.(serialized, progression, undefined, locator.text?.highlight);
  }, []);

  // Skip the first onLocationChange: Readium emits an initial relocate that would overwrite a saved place with chapter 1.
  const firstLocationChangeRef = useRef(true);

  const handleLocationChange = useCallback(
    (locator: Locator) => {
      const hrefChanged = currentLocatorRef.current?.href !== locator.href;
      currentLocatorRef.current = locator;
      setCurrentHref((prev) => (prev === locator.href ? prev : locator.href));
      fireReadyOnce();
      if (hrefChanged) {
        chapterSentencesRef.current = [];
        setSentenceDecoration(null);
      }
      if (locator.title) {
        onChapterChangeRef.current?.({ title: locator.title, index: 0 });
      }
      if (firstLocationChangeRef.current) {
        firstLocationChangeRef.current = false;
        return;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => flushLocator(locator), 1500);
    },
    [flushLocator, fireReadyOnce],
  );

  const handlePublicationReady = useCallback(
    (event: PublicationReadyEvent) => {
      tocRef.current = (event.tableOfContents ?? [])
        .filter((link) => !!link.href)
        .map((link) => ({
          label: link.title ?? link.href,
          href: link.href,
          cfi: null,
        }));
      positionsRef.current = event.positions ?? [];
      fireReadyOnce();
    },
    [fireReadyOnce],
  );

  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        const uri = await ensureEpubLocalUri(epubUrl);
        if (!canceled) setLocalUri(uri);
      } catch (e) {
        if (canceled) return;
        const message = e instanceof Error ? e.message : "EPUB download failed";
        console.warn("[readium-reader] local download failed:", message);
        onErrorRef.current?.(message);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [epubUrl]);

  // Safety net: surface the canvas 10s after the file is local even if no ready event fired, rather than lock on the loading overlay.
  useEffect(() => {
    if (!localUri) return;
    const t = setTimeout(() => {
      if (!readyFiredRef.current) {
        console.warn("[readium-reader] ready-event timeout; falling back");
        fireReadyOnce();
      }
    }, 10_000);
    return () => clearTimeout(t);
  }, [fireReadyOnce, localUri]);

  const handleSelectionChange = useCallback(
    (event: SelectionEvent) => {
      const text = event.selectedText;
      if (!text || !event.locator) return;
      const cfi = encodeLocator(event.locator);
      // Bottom-anchored so the pill never overlaps Android's top selection bar.
      const rect: ReaderRect = {
        x: screenWidth / 2,
        y: screenHeight - 80,
        width: 0,
        height: 0,
      };
      const trimmed = text.trim();
      const isSingleWord = trimmed.length > 0 && !/\s/.test(trimmed) && trimmed.length <= 50;
      if (isSingleWord && onWordTappedRef.current) {
        const before = event.locator.text?.before ?? "";
        const highlight = event.locator.text?.highlight ?? trimmed;
        const after = event.locator.text?.after ?? "";
        const surroundingText = `${before}${highlight}${after}`.trim();
        onWordTappedRef.current(trimmed, surroundingText, cfi, rect);
        return;
      }
      onPassageSelectedRef.current?.(text, cfi, rect);
    },
    [screenWidth, screenHeight],
  );

  const handleDecorationActivated = useCallback((event: DecorationActivatedEvent) => {
    // Only comment markers open a sheet; ignore activations from other decoration groups.
    if (event.group !== PASSAGE_COMMENT_GROUP) return;
    const passageText = event.decoration.locator.text?.highlight ?? "";
    const index = Number(event.decoration.id.split("-")[1]);
    onPassageCommentTappedRef.current?.(commentMarkersRef.current[index]?.cfi ?? null, passageText);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      prev: () => viewRef.current?.goBackward(),
      next: () => viewRef.current?.goForward(),
      goTo: (cfi: string) => {
        const locator = decodeLocator(cfi);
        if (locator) viewRef.current?.goTo(locator);
      },
      applySettings: (s: ReaderSettings) => {
        setReadiumPrefs(settingsToReadiumPreferences(s));
      },
      addHighlight: (cfi: string, color: HighlightColor) => {
        const locator = decodeLocator(cfi);
        if (!locator) return;
        highlightColorKeysRef.current.set(cfi, color);
        setHighlights((prev) => {
          const next = prev.filter((d) => d.id !== cfi);
          return [
            ...next,
            {
              id: cfi,
              locator,
              style: {
                type: "highlight",
                tint: highlightPaletteRef.current[color] ?? "#FFEB3B",
              },
            },
          ];
        });
      },
      setHighlightColors: (map: Record<HighlightColor, string>) => {
        highlightPaletteRef.current = map;
        setHighlights((prev) =>
          prev.map((d) => {
            const colorKey = highlightColorKeysRef.current.get(d.id);
            if (!colorKey) return d;
            return { ...d, style: { ...d.style, tint: map[colorKey] } };
          }),
        );
      },
      setPassageComments: (comments: PassageCommentMarker[], colorHex?: string) => {
        const valid = comments.filter((m) => m.passageText.trim().length > 0);
        commentMarkersRef.current = valid;
        setCommentMarkers(valid);
        if (colorHex) setCommentColor(colorHex);
      },
      setPopularHighlights: (
        list: Array<{ text?: string; cfi: string; count: number }>,
        colorHex?: string,
      ) => {
        setPopularMarkers(list);
        if (colorHex) setPopularColor(colorHex);
      },
      getChapterText: async () => {
        const href = currentLocatorRef.current?.href;
        if (!href) return "";
        const { text } = await getChapterContent(epubUrl, href);
        chapterSentencesRef.current = splitSentences(text);
        return text;
      },
      getToc: async () => tocRef.current,
      jumpToProgress: (fraction: number) => {
        const positions = positionsRef.current;
        if (positions.length === 0) return;
        const clamped = Math.max(0, Math.min(1, fraction));
        let closest = positions[0];
        let closestDiff = Infinity;
        for (const p of positions) {
          const tp = p.locations?.totalProgression ?? 0;
          const diff = Math.abs(tp - clamped);
          if (diff < closestDiff) {
            closestDiff = diff;
            closest = p;
          }
        }
        viewRef.current?.goTo(closest);
      },
      highlightSentence: (index: number | null) => {
        if (index === null) {
          setSentenceDecoration(null);
          return;
        }
        const sentence = chapterSentencesRef.current[index - 1];
        const currentLoc = currentLocatorRef.current;
        if (!sentence || !currentLoc) return;
        // Text-based locator: Readium matches text.highlight against the rendered page; before/after windows are not available from the chapter parser.
        setSentenceDecoration({
          id: `tts-${index}`,
          locator: {
            href: currentLoc.href,
            type: currentLoc.type,
            text: { highlight: sentence },
          },
          style: {
            type: "highlight",
            tint: "#FFE082",
          },
        });
      },
    }),
    [epubUrl],
  );

  // Single short tap with tight tolerance so swipes and long-presses pass through to Readium; onTap read via ref keeps the gesture stable.
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .maxDistance(10)
        .onEnd((_e, success) => {
          if (success) onTapRef.current?.();
        })
        .runOnJS(true),
    [],
  );

  // Long-press (500ms) raises the selection threshold, composed with tapGesture via Race.
  // Android's native long-press timer runs in parallel (~400ms), so selection can still start earlier on some devices.
  const longPressGesture = useMemo(
    () => Gesture.LongPress().minDuration(500).maxDistance(10).runOnJS(true),
    [],
  );

  const composedGesture = useMemo(
    () => Gesture.Race(tapGesture, longPressGesture),
    [tapGesture, longPressGesture],
  );

  // Stable ReadiumView props: new file/preferences identity would reload the publication to initialLocation.
  const file = useMemo(
    () => (localUri ? { url: localUri, initialLocation: initialLocator } : null),
    [localUri, initialLocator],
  );
  const preferencesProp = useMemo(() => readiumPrefs, [readiumPrefs]);
  // A non-empty selectionActions array makes EpubReaderFragment install our ActionMode.Callback, which scripts/patch-readium.mjs makes return false so Android shows no toolbar; the Highlight handler below is a fallback.
  const selectionActions = useMemo<SelectionAction[]>(
    () => [{ id: "highlight", label: "Highlight" }],
    [],
  );

  // No internal loading overlay: the host renders "Loading book…" and covers the empty View until the EPUB is downloaded.
  if (!file) {
    return <View style={{ flex: 1, backgroundColor: initialSettings.theme.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: initialSettings.theme.background }}>
      <GestureDetector gesture={composedGesture}>
        <View style={{ flex: 1 }}>
          <ReadiumView
            ref={viewRef}
            file={file}
            preferences={preferencesProp}
            decorations={decorations}
            selectionActions={selectionActions}
            onLocationChange={handleLocationChange}
            onPublicationReady={handlePublicationReady}
            onSelectionChange={handleSelectionChange}
            onDecorationActivated={handleDecorationActivated}
            style={{ flex: 1 }}
          />
        </View>
      </GestureDetector>
    </View>
  );
});

ReadiumReader.displayName = "ReadiumReader";
