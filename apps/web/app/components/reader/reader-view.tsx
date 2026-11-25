// The reading surface: a server shell that mounts the Readium engine client-side (lazy, so ts-toolkit never loads on
// catalog pages or during SSR). Writes go to /api/v1 from the browser and surface every failure.
import { useBookAnnotations } from "@foxing/client";
import type { ReaderAnnotations } from "@foxing/types";
import { readStored } from "capsomer/behavior/hooks";
import { useRemembered } from "capsomer/react/hooks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { annotationPct, type HighlightColor } from "@foxing/core";
import type {
  CreateEngineOptions,
  DecorationRect,
  ReaderEngine,
  SelectionPayload,
  TocEntry,
} from "~/lib/reader/engine.client";
import { enrichSelectionLocator, type Locator } from "~/lib/reader/locator";
import { READING_CANVAS, type ReaderSettings } from "~/lib/reader/settings";
import {
  LAYERS_KEY,
  type LayerState,
  PROGRESS_DEBOUNCE,
  type ReaderAnnotation,
  type ReaderComment,
  type ReaderOther,
  type ReaderPopular,
  SETTINGS_KEY,
  parseLayers,
  parseSettings,
  samePosition,
  anchorFromRect,
  highlightSpecs,
  popularSpecs,
} from "./reader-types";
import { ProgressScrubber } from "./reader-scrubber";
import { usePageKeys, useReaderWrites } from "./reader-writes";
import { AttributionPopover, EditPopover, NoteComposer, SelectionToolbar } from "./reader-popovers";
import {
  ContentsList,
  ReaderTopBar,
  SidePanel,
  SignInPrompt,
  TypographyControls,
  WriteStatus,
} from "./reader-panels";

interface ReaderViewProps {
  book: { id: string; slug: string; title: string; author: string };
  manifestUrl: string;
  signedIn: boolean;
  loginHref: string;
  layers: ReaderAnnotations;
  shareableClubs: { id: string; name: string }[];
  initialLocator: Locator | null;
}

export function ReaderView(props: ReaderViewProps) {
  const { book, manifestUrl, signedIn, loginHref, initialLocator, shareableClubs } = props;
  const canShareToClub = shareableClubs.length > 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReaderEngine | null>(null);
  const currentLocatorRef = useRef<Locator | null>(initialLocator);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = useRef(() => {}); // saves the position waiting out the debounce, when the reader leaves
  const lastSavedRef = useRef<Locator | null>(initialLocator);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  // Settings and layers are kept in this browser (useRemembered): defaults on the server and while hydrating.
  const [storedSettings, rememberSettings] = useRemembered(SETTINGS_KEY);
  const settings = useMemo(() => parseSettings(storedSettings), [storedSettings]);
  // The layers live in the shared cache: every write patches it first and rolls back on failure.
  const resolved = useBookAnnotations(book.id, props.layers).data;
  const annotations = resolved.mine as ReaderAnnotation[];
  const others = resolved.others as unknown as ReaderOther[];
  const comments = resolved.comments as unknown as ReaderComment[];
  const popular = resolved.popular as unknown as ReaderPopular[];
  const [storedLayers, rememberLayers] = useRemembered(LAYERS_KEY);
  const layers = useMemo(() => parseLayers(storedLayers), [storedLayers]);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [attribution, setAttribution] = useState<ReaderOther | null>(null);
  const [attributionAnchor, setAttributionAnchor] = useState<DecorationRect | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [pct, setPct] = useState(annotationPct(initialLocator) ?? 0);
  const [chapter, setChapter] = useState("");
  const [panel, setPanel] = useState<"toc" | "type" | null>(null);
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ color: HighlightColor; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = annotations.find((a) => a.id === editingId) ?? null; // from the cache, so a color change shows
  const setEditing = (a: ReaderAnnotation | null) => setEditingId(a?.id ?? null);
  // Viewport-space rect of the tapped highlight; null from the Contents list (the popover then floats bottom-center).
  const [editAnchor, setEditAnchor] = useState<DecorationRect | null>(null);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const requireSignIn = useCallback((): boolean => {
    if (signedIn) return true;
    setSelection(null);
    setNoteDraft(null);
    setSignInPrompt(true);
    return false;
  }, [signedIn]);
  const {
    saving,
    writeError,
    dismissWriteError,
    saveFire,
    persistAnnotation,
    patchAnnotation,
    removeAnnotation,
    toggleLike,
    postReply,
  } = useReaderWrites({ bookId: book.id, currentLocatorRef, requireSignIn, setAttribution });

  const settingsRef = useRef(settings);
  const annotationsRef = useRef(annotations);
  const othersRef = useRef(others);
  const layersRef = useRef(layers);
  const popularRef = useRef(popular);
  useLayoutEffect(() => {
    settingsRef.current = settings;
    annotationsRef.current = annotations;
    othersRef.current = others;
    layersRef.current = layers;
    popularRef.current = popular;
  });

  const redraw = useCallback(() => {
    const layerState = layersRef.current;
    const theme = settingsRef.current.theme;
    engineRef.current?.applyHighlights(
      highlightSpecs(annotationsRef.current, othersRef.current, layerState),
      theme,
    );
    engineRef.current?.applyPopular(popularSpecs(popularRef.current, layerState), theme);
  }, []);

  const scheduleSave = useCallback(
    (loc: Locator) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flushSave.current = () => {
        flushSave.current = () => {};
        if (samePosition(loc, lastSavedRef.current)) return;
        lastSavedRef.current = loc;
        saveFire({ bookId: book.id, locator: loc, progressPct: annotationPct(loc) ?? 0 });
      };
      saveTimer.current = setTimeout(flushSave.current, PROGRESS_DEBOUNCE);
    },
    [book.id, saveFire],
  );

  // Boot once per book: its inputs are session-stable or read through refs, so re-running would rebuild the navigator.
  useEffect(() => {
    const initial = parseSettings(readStored(SETTINGS_KEY));
    settingsRef.current = initial;
    layersRef.current = parseLayers(readStored(LAYERS_KEY));

    let destroyed = false;
    void (async () => {
      try {
        const { createEngine } = await import("~/lib/reader/engine.client");
        if (!containerRef.current) throw new Error("no container");
        const opts: CreateEngineOptions = {
          container: containerRef.current,
          manifestUrl,
          initialLocator,
          settings: initial,
          listeners: {
            onPosition: (loc) => {
              currentLocatorRef.current = loc;
              // The container's position, which a browser test waits on for a page turn or Contents jump.
              containerRef.current?.setAttribute(
                "data-position",
                `${loc.href}@${String(loc.locations?.progression ?? 0)}`,
              );
              setPct(annotationPct(loc) ?? 0);
              if (typeof loc.title === "string") setChapter(loc.title);
              setSelection(null);
              setEditing(null);
              setEditAnchor(null);
              setAttribution(null);
              setAttributionAnchor(null);
              if (signedIn) scheduleSave(loc);
            },
            onSelection: (payload) => {
              setEditing(null);
              setEditAnchor(null);
              setSelection(payload);
            },
            onDecorationActivated: (id, rect) => {
              // One tap resolves to one id: your own (the fill) first, then another reader's (the underline).
              const mine = annotationsRef.current.find((a) => a.id === id);
              const other = mine ? null : othersRef.current.find((o) => o.id === id);
              if (!mine && !other) return;
              setSelection(null);
              const anchor = anchorFromRect(containerRef.current, rect);
              if (mine) {
                setAttribution(null);
                setAttributionAnchor(null);
                setEditAnchor(anchor);
                setEditing(mine);
              } else if (other) {
                setEditing(null);
                setEditAnchor(null);
                setAttributionAnchor(anchor);
                setAttribution(other);
              }
            },
            onReady: () => {
              if (destroyed) return;
              setStatus("ready");
            },
          },
        };
        const engine = await createEngine(opts);
        if (destroyed) {
          await engine.destroy();
          return;
        }
        engineRef.current = engine;
        setToc(engine.toc);
        // onReady fires inside createEngine before engineRef is set, so redraw here for saved and shared annotations to reappear on reload.
        redraw();
      } catch (e) {
        if (destroyed) return;
        setStatus("error");
        setErrorMsg((e as Error).message);
      }
    })();

    return () => {
      destroyed = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flushSave.current();
      void engineRef.current?.destroy();
      engineRef.current = null;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- mount once per book; inputs are session-stable or ref-read
  }, [manifestUrl]);

  usePageKeys(engineRef, !!(panel || noteDraft || editing || signInPrompt || attribution));

  const updateSettings = useCallback(
    (patch: Partial<ReaderSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      rememberSettings(JSON.stringify(next));
      engineRef.current?.applySettings(next).catch(() => {});
      if (patch.theme) redraw();
    },
    [redraw, rememberSettings],
  );

  const clearNativeSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const f of Array.from(container.querySelectorAll("iframe"))) {
      f.contentWindow?.getSelection?.()?.removeAllRanges();
    }
  }, []);

  const highlightSelection = useCallback(
    async (color: HighlightColor, body?: string, shareToClub?: boolean) => {
      if (!requireSignIn()) return;
      const sel = selection;
      if (!sel) return;
      const locator = enrichSelectionLocator(
        sel.locator,
        sel.context,
        currentLocatorRef.current?.locations,
      );
      await persistAnnotation({
        type: body ? "note" : "highlight",
        locator,
        color,
        body,
        selectedText: sel.text,
        visibility: shareToClub && canShareToClub ? "club" : undefined,
      });
      setSelection(null);
      setNoteDraft(null);
      clearNativeSelection();
    },
    [selection, requireSignIn, persistAnnotation, clearNativeSelection, canShareToClub],
  );

  const addBookmark = useCallback(async () => {
    if (!requireSignIn()) return;
    const loc = currentLocatorRef.current;
    if (!loc) return;
    await persistAnnotation({ type: "bookmark", locator: loc });
  }, [requireSignIn, persistAnnotation]);

  const deleteAnnotation = useCallback(
    (id: string) => {
      removeAnnotation(id);
      setEditing(null);
      setEditAnchor(null);
    },
    [removeAnnotation],
  );

  useEffect(() => {
    redraw();
    // oxlint-disable-next-line react/exhaustive-deps -- redraw reads live refs; these are the triggers
  }, [layers, annotations, others, popular]);

  const toggleLayer = useCallback(
    (key: keyof LayerState) => {
      const prev = layersRef.current;
      const next = { ...prev, [key]: !prev[key] };
      layersRef.current = next;
      rememberLayers(JSON.stringify(next));
    },
    [rememberLayers],
  );

  const canvas = READING_CANVAS[settings.theme];
  const bookmarks = annotations.filter((a) => a.type === "bookmark");
  const marks = annotations.filter(
    (a) => (a.type === "highlight" || a.type === "note") && a.locator,
  );

  const openMark = useCallback((a: ReaderAnnotation) => {
    if (a.locator) engineRef.current?.goToLocator(a.locator);
    setPanel(null);
    setEditAnchor(null);
    setEditing(a);
  }, []);

  return (
    <div className="fx-reader-view-stack" style={{ background: canvas.bg, color: canvas.text }}>
      <ReaderTopBar
        book={book}
        chapter={chapter}
        background={canvas.bg}
        panel={panel}
        onTogglePanel={(p) => setPanel(panel === p ? null : p)}
        onBookmark={() => void addBookmark()}
        layers={layers}
        onToggleLayer={toggleLayer}
        clubsCount={others.filter((o) => o.layer !== "public").length}
        everyoneCount={others.filter((o) => o.layer === "public").length + popular.length}
      />

      {/* Reading area */}
      <div className="relative fx-reader-view-box">
        {status !== "ready" ? (
          <div className="fx-reader-view-grid" role="status">
            {status === "error" ? `Could not open this book. ${errorMsg}` : "Opening book…"}
          </div>
        ) : null}

        {/* Prev / next edge controls */}
        <button
          type="button"
          onClick={() => engineRef.current?.prev()}
          aria-label="Previous page"
          className="fx-reader-view-btn"
        />
        <button
          type="button"
          onClick={() => engineRef.current?.next()}
          aria-label="Next page"
          className="fx-reader-view-btn-2"
        />

        {/* The engine iframe fills this box (see .readium-navigator-iframe in app.css),
            so it defines the reading column: centered, capped at a comfortable measure
            (~single 40rem column, wider for two-column mode). */}
        <div
          ref={containerRef}
          data-testid="reader-container"
          className="relative fx-reader-view-box-2"
          style={{ maxWidth: !settings.scroll && settings.columns === 2 ? "64rem" : "40rem" }}
        />
      </div>

      <ProgressScrubber
        pct={pct}
        background={canvas.bg}
        onSeek={(v) => {
          setPct(v);
          engineRef.current?.goToTotalProgression(v / 100);
        }}
      />

      {/* Selection toolbar (bottom-center; robust across paginated/scroll) */}
      {selection && !noteDraft ? (
        <SelectionToolbar
          canvas={canvas}
          canShareToClub={canShareToClub}
          onColor={(c, share) => void highlightSelection(c, undefined, share)}
          onNote={() => setNoteDraft({ color: "amber", text: "" })}
          onDismiss={() => {
            setSelection(null);
            clearNativeSelection();
          }}
        />
      ) : null}

      {/* Note composer */}
      {noteDraft ? (
        <NoteComposer
          draft={noteDraft}
          canvas={canvas}
          canShareToClub={canShareToClub}
          onChange={setNoteDraft}
          onSave={(share) =>
            void highlightSelection(noteDraft.color, noteDraft.text.trim() || undefined, share)
          }
          onCancel={() => {
            setNoteDraft(null);
            setSelection(null);
            clearNativeSelection();
          }}
        />
      ) : null}

      {/* Edit popover for an existing highlight/note, anchored to the tapped passage */}
      {editing ? (
        <EditPopover
          annotation={editing}
          anchor={editAnchor}
          canvas={canvas}
          onColor={(c) => patchAnnotation(editing.id, { color: c })}
          onSaveNote={(body) => patchAnnotation(editing.id, { body: body || null })}
          onDelete={() => deleteAnnotation(editing.id)}
          onClose={() => {
            setEditing(null);
            setEditAnchor(null);
          }}
        />
      ) : null}

      {/* Attribution popover for another reader's shared annotation: author, gated note,
          reactions, and the reply thread. */}
      {attribution ? (
        <AttributionPopover
          key={attribution.id}
          other={attribution}
          anchor={attributionAnchor}
          canvas={canvas}
          replies={comments.filter((c) => c.parentId === attribution.id)}
          revealed={revealed.has(attribution.id)}
          shareableClubs={shareableClubs}
          onReveal={() => setRevealed((prev) => new Set(prev).add(attribution.id))}
          onToggleLike={() => toggleLike(attribution)}
          onReply={(clubId, body) => postReply(attribution, clubId, body)}
          onClose={() => {
            setAttribution(null);
            setAttributionAnchor(null);
          }}
        />
      ) : null}

      {panel === "toc" ? (
        <SidePanel title="Contents" onClose={() => setPanel(null)} canvas={canvas}>
          <ContentsList
            toc={toc}
            bookmarks={bookmarks}
            marks={marks}
            onGoToHref={(href) => {
              engineRef.current?.goToHref(href);
              setPanel(null);
            }}
            onGoToLocator={(locator) => {
              if (locator) engineRef.current?.goToLocator(locator);
              setPanel(null);
            }}
            onDelete={deleteAnnotation}
            onOpenMark={openMark}
          />
        </SidePanel>
      ) : null}

      {panel === "type" ? (
        <SidePanel title="Text settings" onClose={() => setPanel(null)} canvas={canvas}>
          <TypographyControls settings={settings} onChange={updateSettings} />
        </SidePanel>
      ) : null}

      {signInPrompt ? (
        <SignInPrompt loginHref={loginHref} onClose={() => setSignInPrompt(false)} />
      ) : null}

      <WriteStatus saving={saving} writeError={writeError} onDismiss={dismissWriteError} />
    </div>
  );
}
