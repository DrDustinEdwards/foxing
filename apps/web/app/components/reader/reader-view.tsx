// The reading surface. Renders a shell on the server and mounts the Readium
// engine client-side (lazy import, so ts-toolkit never loads on catalog pages or
// during SSR). Owns navigation, TOC, the progress scrubber, typography controls,
// keyboard nav, and annotations (7-color highlights, notes, bookmarks). Writes go
// to /api/v1 (annotations + progress) from the browser and surface every failure;
// anonymous readers can read fully and are prompted to sign in for personal features.
import { useCallback, useEffect, useRef, useState } from "react";
import type { HighlightColor } from "@foxing/core";
import type {
  CreateEngineOptions,
  DecorationRect,
  ReaderEngine,
  SelectionPayload,
  TocEntry,
} from "~/lib/reader/engine.client";
import { enrichSelectionLocator, progressPctFromLocator, type Locator } from "~/lib/reader/locator";
import {
  DEFAULT_SETTINGS,
  READING_CANVAS,
  type ReaderSettings,
  type ReaderTheme,
} from "~/lib/reader/settings";
import {
  DEFAULT_LAYERS,
  LAYERS_KEY,
  type LayerState,
  PROGRESS_DEBOUNCE,
  type ReaderAnnotation,
  type ReaderComment,
  type ReaderOther,
  type ReaderPopular,
  SETTINGS_KEY,
  layerShown,
  loadLayers,
  loadSettings,
  samePosition,
  visibleFrame,
} from "./reader-types";
import { useApiWrite } from "./use-api-write";
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
  annotations: ReaderAnnotation[];
  others: ReaderOther[];
  comments: ReaderComment[];
  popular: ReaderPopular[];
  shareableClubs: { id: string; name: string }[];
  viewerProgressPct: number | null;
  initialLocator: Locator | null;
}

export function ReaderView(props: ReaderViewProps) {
  const { book, manifestUrl, signedIn, loginHref, initialLocator, shareableClubs } = props;
  const canShareToClub = shareableClubs.length > 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReaderEngine | null>(null);
  const currentLocatorRef = useRef<Locator | null>(initialLocator);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last position we actually persisted (seeded with the restored one), so we never
  // re-save an unchanged position.
  const lastSavedRef = useRef<Locator | null>(initialLocator);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>(props.annotations);
  const [others, setOthers] = useState<ReaderOther[]>(props.others);
  const [comments, setComments] = useState<ReaderComment[]>(props.comments);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  // Ids the reader chose to reveal past their spoiler/ahead gate, this session only.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  // The other reader's annotation whose attribution popover is open (distinct from the
  // owner EditPopover, which is for your own marks).
  const [attribution, setAttribution] = useState<ReaderOther | null>(null);
  const [attributionAnchor, setAttributionAnchor] = useState<DecorationRect | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [pct, setPct] = useState(progressPctFromLocator(initialLocator));
  const [chapter, setChapter] = useState("");
  const [panel, setPanel] = useState<"toc" | "type" | null>(null);
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ color: HighlightColor; text: string } | null>(null);
  const [editing, setEditing] = useState<ReaderAnnotation | null>(null);
  // Viewport-space rect of the tapped highlight, so the popover anchors to the
  // passage. Null when opened from the Contents list (then it floats bottom-center).
  const [editAnchor, setEditAnchor] = useState<DecorationRect | null>(null);
  const [signInPrompt, setSignInPrompt] = useState(false);
  // Personal-feature writes (highlights, notes, bookmarks, progress) go to /api/v1
  // and never swallow a failure: saving drives a role="status" indicator, writeError
  // a role="alert" banner (mirrors book-status-control's visible-write pattern).
  const { apiWrite, saving, writeError, setWriteError } = useApiWrite();

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const othersRef = useRef(others);
  othersRef.current = others;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const popularRef = useRef(props.popular);
  popularRef.current = props.popular;

  // Redraw the decoration layers from the current mine/others sets, honoring the layer
  // toggles. Your own always render when the Mine layer is on; others render as an
  // underline in the author's color when their layer group is on ("My clubs" = club +
  // friend, "Everyone" = public). Popular is drawn separately as an ambient underline.
  const reapplyHighlights = useCallback(
    (
      mine: ReaderAnnotation[],
      othersList: ReaderOther[],
      layerState: LayerState,
      theme: ReaderTheme,
    ) => {
      const mineSpecs = layerState.mine
        ? mine
            .filter((a) => (a.type === "highlight" || a.type === "note") && a.locator)
            .map((a) => ({
              id: a.id,
              locator: a.locator as Locator,
              color: (a.color as HighlightColor) ?? "amber",
              hasNote: !!a.body?.trim(),
              ownership: "mine" as const,
            }))
        : [];
      const otherSpecs = othersList
        .filter((o) => o.locator && layerShown(o.layer, layerState))
        .map((o) => ({
          id: o.id,
          locator: o.locator as Locator,
          color: (o.color as HighlightColor) ?? "amber",
          hasNote: !!o.body?.trim(),
          ownership: "other" as const,
        }));
      engineRef.current?.applyHighlights([...mineSpecs, ...otherSpecs], theme);
    },
    [],
  );

  const redraw = useCallback(() => {
    const layerState = layersRef.current;
    const theme = settingsRef.current.theme;
    reapplyHighlights(annotationsRef.current, othersRef.current, layerState, theme);
    // Popular follows the Everyone layer; drawn separately as an ambient underline.
    const popularSpecs = layerState.everyone
      ? popularRef.current
          .filter((p) => p.locator)
          .map((p, i) => ({ id: `popular-${i}`, locator: p.locator as Locator }))
      : [];
    engineRef.current?.applyPopular(popularSpecs, theme);
  }, [reapplyHighlights]);

  // Boot: load saved settings, build the engine, wire listeners. Mounts once per
  // book; all inputs it needs (signedIn, initialLocator, the callbacks) are stable
  // for a reading session or read through refs, so re-running on their identity
  // would needlessly rebuild the navigator.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once per book; inputs are session-stable or ref-read
  useEffect(() => {
    const initial = loadSettings();
    setSettings(initial);
    settingsRef.current = initial;
    const initialLayers = loadLayers();
    setLayers(initialLayers);
    layersRef.current = initialLayers;

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
              // Where the reader stands, on the container: a browser test waits on it for a
              // page turn or a Contents jump to land.
              containerRef.current?.setAttribute(
                "data-position",
                `${loc.href}@${String(loc.locations?.progression ?? 0)}`,
              );
              setPct(progressPctFromLocator(loc));
              if (typeof loc.title === "string") setChapter(loc.title);
              setSelection(null);
              // Turning the page moves away from the anchored passage, so close its
              // popover rather than leaving it floating over unrelated text.
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
              // One tap resolves to exactly one id, in either layer. Prefer your own
              // (the fill) then fall back to an other reader's (the underline).
              const mine = annotationsRef.current.find((a) => a.id === id);
              const other = mine ? null : othersRef.current.find((o) => o.id === id);
              if (!mine && !other) return;
              setSelection(null);
              // The rect arrives in device pixels relative to the content frame's
              // viewport (the injectable scales by devicePixelRatio and the navigator
              // forwards it as-is). Convert to CSS pixels and offset by the frame's
              // position so the fixed popover lands on the passage. The engine keeps a
              // pool of frames; pick the shown one (the others are hidden), never the
              // first in DOM order.
              const iframe = visibleFrame(containerRef.current);
              const fr = iframe?.getBoundingClientRect();
              const dpr = window.devicePixelRatio || 1;
              const anchor =
                rect && fr
                  ? {
                      top: fr.top + rect.top / dpr,
                      left: fr.left + rect.left / dpr,
                      width: rect.width / dpr,
                      height: rect.height / dpr,
                    }
                  : null;
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
        // Render the user's saved highlights/notes AND any active social layers now
        // that engineRef is set: applyHighlights/applyPopular go through engineRef, and
        // onReady fires from inside createEngine (before this assignment), so redrawing
        // here is what makes saved + shared annotations reappear on reload.
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
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [manifestUrl]);

  const scheduleSave = useCallback(
    (loc: Locator) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        // Don't re-persist the position we already saved (the restore navigation
        // re-emits it, which would flash "Saving..." on every reload for nothing).
        if (samePosition(loc, lastSavedRef.current)) return;
        lastSavedRef.current = loc;
        void apiWrite(`/books/${book.id}/progress`, {
          method: "PUT",
          body: { locator: loc, progressPct: progressPctFromLocator(loc) },
        });
      }, PROGRESS_DEBOUNCE);
    },
    [book.id, apiWrite],
  );

  // Keyboard navigation (ignored while a panel, composer, or prompt is open, or
  // when focus is in a text field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || noteDraft || editing || signInPrompt || attribution) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        engineRef.current?.next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        engineRef.current?.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, noteDraft, editing, signInPrompt, attribution]);

  const updateSettings = useCallback(
    (patch: Partial<ReaderSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        settingsRef.current = next;
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota/private-mode */
        }
        engineRef.current?.applySettings(next).catch(() => {});
        if (patch.theme) redraw();
        return next;
      });
    },
    [redraw],
  );

  const requireSignIn = useCallback((): boolean => {
    if (signedIn) return true;
    setSelection(null);
    setNoteDraft(null);
    setSignInPrompt(true);
    return false;
  }, [signedIn]);

  const clearNativeSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const f of Array.from(container.querySelectorAll("iframe"))) {
      f.contentWindow?.getSelection?.()?.removeAllRanges();
    }
  }, []);

  const persistAnnotation = useCallback(
    async (payload: {
      type: "highlight" | "note" | "bookmark";
      locator: Locator;
      color?: HighlightColor;
      body?: string;
      selectedText?: string;
      // 'club' is the explicit share-to-club exposure; omitted lets the server resolve
      // the reader's default-annotation visibility.
      visibility?: "club";
    }) => {
      const chapterTitle = currentLocatorRef.current?.title;
      const res = await apiWrite(`/annotations`, {
        method: "POST",
        body: { ...payload, bookId: book.id, chapter: chapterTitle },
      });
      if (!res) return null;
      const { annotation } = (await res.json()) as {
        annotation: { id: string; createdAt: number };
      };
      const optimistic: ReaderAnnotation = {
        id: annotation.id,
        type: payload.type,
        locator: payload.locator,
        selectedText: payload.selectedText ?? null,
        body: payload.body ?? null,
        color: payload.color ?? null,
        chapter: chapterTitle ?? null,
      };
      setAnnotations((prev) => {
        const next = [...prev, optimistic];
        reapplyHighlights(next, othersRef.current, layersRef.current, settingsRef.current.theme);
        return next;
      });
      return optimistic;
    },
    [book.id, apiWrite, reapplyHighlights],
  );

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

  const patchAnnotation = useCallback(
    async (id: string, patch: { color?: HighlightColor; body?: string | null }) => {
      const res = await apiWrite(`/annotations/${id}`, { method: "PATCH", body: patch });
      if (!res) return;
      setAnnotations((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
        reapplyHighlights(next, othersRef.current, layersRef.current, settingsRef.current.theme);
        return next;
      });
    },
    [apiWrite, reapplyHighlights],
  );

  const deleteAnnotation = useCallback(
    async (id: string) => {
      const res = await apiWrite(`/annotations/${id}`, { method: "DELETE" });
      if (!res) return;
      setAnnotations((prev) => {
        const next = prev.filter((a) => a.id !== id);
        reapplyHighlights(next, othersRef.current, layersRef.current, settingsRef.current.theme);
        return next;
      });
      setEditing(null);
      setEditAnchor(null);
    },
    [apiWrite, reapplyHighlights],
  );

  // Toggling a layer redraws the decoration set. Others/comments come from the loader
  // and change only via replies/likes (which do not alter decorations), so the layers
  // are the redraw trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw reads live refs; layers is the trigger
  useEffect(() => {
    redraw();
  }, [layers]);

  const toggleLayer = useCallback((key: keyof LayerState) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      layersRef.current = next;
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/private-mode */
      }
      return next;
    });
  }, []);

  const reveal = useCallback((id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Like / unlike another reader's annotation. Optimistic; reverts on failure. Goes to
  // the generic reactions endpoint (target_type='annotation').
  const toggleLike = useCallback(
    async (other: ReaderOther) => {
      if (!requireSignIn()) return;
      const liked = other.likedByMe;
      const apply = (delta: number, likedByMe: boolean) =>
        setOthers((prev) =>
          prev.map((o) =>
            o.id === other.id
              ? { ...o, likedByMe, likeCount: Math.max(0, o.likeCount + delta) }
              : o,
          ),
        );
      apply(liked ? -1 : 1, !liked);
      setAttribution((cur) =>
        cur && cur.id === other.id
          ? { ...cur, likedByMe: !liked, likeCount: Math.max(0, cur.likeCount + (liked ? -1 : 1)) }
          : cur,
      );
      const res = await apiWrite(`/reactions`, {
        method: liked ? "DELETE" : "PUT",
        body: { targetType: "annotation", targetId: other.id, kind: "like" },
      });
      if (!res) apply(liked ? 1 : -1, liked); // revert
    },
    [requireSignIn, apiWrite],
  );

  // Reply to another reader's annotation, posted into a shared club (the passage-comment
  // write path enforces active membership of that club in core). clubId is implicit when
  // the viewer shares one club with the author; otherwise the popover offers a picker.
  const postReply = useCallback(
    async (other: ReaderOther, clubId: string, body: string) => {
      if (!requireSignIn()) return false;
      const res = await apiWrite(`/annotations/comments`, {
        method: "POST",
        body: {
          clubId,
          bookId: book.id,
          body,
          parentId: other.id,
          locator: other.locator ?? undefined,
        },
      });
      if (!res) return false;
      const { annotation } = (await res.json()) as {
        annotation: { id: string; createdAt: number; clubId: string | null };
      };
      const newComment: ReaderComment = {
        id: annotation.id,
        clubId: annotation.clubId,
        parentId: other.id,
        locator: other.locator,
        body,
        chapter: other.chapter,
        isPinned: false,
        containsSpoilers: false,
        gate: { spoiler: false, ahead: false },
        author: { id: "me", username: null, displayName: "You", avatarUrl: null },
        createdAt: annotation.createdAt,
      };
      setComments((prev) => [...prev, newComment]);
      setOthers((prev) =>
        prev.map((o) => (o.id === other.id ? { ...o, replyCount: o.replyCount + 1 } : o)),
      );
      setAttribution((cur) =>
        cur && cur.id === other.id ? { ...cur, replyCount: cur.replyCount + 1 } : cur,
      );
      return true;
    },
    [requireSignIn, apiWrite, book.id],
  );

  const canvas = READING_CANVAS[settings.theme];
  const bookmarks = annotations.filter((a) => a.type === "bookmark");
  // Persistent list of highlights + notes: the reliable way to see which passages
  // carry a note and to reopen one (the in-text tap works too, but this is always
  // available). Clicking an entry jumps to it and opens its edit/delete popover.
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
    <div
      className="fixed inset-0 flex flex-col font-ui"
      style={{ background: canvas.bg, color: canvas.text }}
    >
      <ReaderTopBar
        book={book}
        chapter={chapter}
        background={canvas.bg}
        panel={panel}
        onTogglePanel={(p) => setPanel(panel === p ? null : p)}
        onBookmark={addBookmark}
        layers={layers}
        onToggleLayer={toggleLayer}
        clubsCount={others.filter((o) => o.layer !== "public").length}
        everyoneCount={others.filter((o) => o.layer === "public").length + props.popular.length}
      />

      {/* Reading area */}
      <div className="relative flex-1 overflow-hidden">
        {status !== "ready" ? (
          <div
            className="absolute inset-0 z-10 grid place-items-center text-sm text-tertiary"
            role="status"
          >
            {status === "error" ? `Could not open this book. ${errorMsg}` : "Opening book…"}
          </div>
        ) : null}

        {/* Prev / next edge controls */}
        <button
          type="button"
          onClick={() => engineRef.current?.prev()}
          aria-label="Previous page"
          className="absolute left-0 top-0 z-[5] h-full w-[12%] cursor-w-resize bg-transparent"
        />
        <button
          type="button"
          onClick={() => engineRef.current?.next()}
          aria-label="Next page"
          className="absolute right-0 top-0 z-[5] h-full w-[12%] cursor-e-resize bg-transparent"
        />

        {/* The engine iframe fills this box (see .readium-navigator-iframe in app.css),
            so it defines the reading column: centered, capped at a comfortable measure
            (~single 40rem column, wider for two-column mode). */}
        <div
          ref={containerRef}
          data-testid="reader-container"
          className="relative mx-auto h-full w-full"
          style={{ maxWidth: !settings.scroll && settings.columns === 2 ? "64rem" : "40rem" }}
        />
      </div>

      {/* Bottom progress scrubber */}
      <footer className="border-t border-border-subtle px-4 py-2" style={{ background: canvas.bg }}>
        <label className="flex items-center gap-3 text-xs text-[color-mix(in_srgb,currentColor_60%,transparent)]">
          <span className="tabular-nums" aria-hidden>
            {pct.toFixed(0)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={pct}
            aria-label="Reading progress"
            className="h-1 flex-1 cursor-pointer accent-[color:var(--brand-ui)]"
            onChange={(e) => {
              const v = Number(e.target.value);
              setPct(v);
              engineRef.current?.goToTotalProgression(v / 100);
            }}
          />
        </label>
      </footer>

      {/* Selection toolbar (bottom-center; robust across paginated/scroll) */}
      {selection && !noteDraft ? (
        <SelectionToolbar
          canvas={canvas}
          canShareToClub={canShareToClub}
          onColor={(c, share) => highlightSelection(c, undefined, share)}
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
            highlightSelection(noteDraft.color, noteDraft.text.trim() || undefined, share)
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
          progressGateEnabled
          shareableClubs={shareableClubs}
          onReveal={() => reveal(attribution.id)}
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

      <WriteStatus saving={saving} writeError={writeError} onDismiss={() => setWriteError(null)} />
    </div>
  );
}
