// The reading surface. Renders a shell on the server and mounts the Readium
// engine client-side (lazy import, so ts-toolkit never loads on catalog pages or
// during SSR). Owns navigation, TOC, the progress scrubber, typography controls,
// keyboard nav, and annotations (7-color highlights, notes, bookmarks). Writes go
// to /api/v1 (annotations + progress) from the browser and surface every failure;
// anonymous readers can read fully and are prompted to sign in for personal features.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { HighlightColor } from "@foxing/core";
import { highlightColorValues } from "@foxing/core";
import type {
  CreateEngineOptions,
  DecorationRect,
  ReaderEngine,
  SelectionPayload,
  TocEntry,
} from "~/lib/reader/engine.client";
import {
  enrichSelectionLocator,
  progressPctFromLocator,
  tintFor,
  type Locator,
} from "~/lib/reader/locator";
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  MARGIN_RANGE,
  READING_CANVAS,
  type ReaderSettings,
  type ReaderTheme,
} from "~/lib/reader/settings";

export interface ReaderAnnotation {
  id: string;
  type: "highlight" | "note" | "bookmark";
  locator: Locator | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
}

export interface AnnotationAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

// Another reader's shared annotation, resolved + tagged server-side. `gate` is the
// courtesy collapse decision (spoiler/ahead); the body is present so tap-to-reveal is
// instant, but rendered collapsed until revealed.
export interface ReaderOther {
  id: string;
  type: "highlight" | "note";
  locator: Locator | null;
  selectedText: string | null;
  body: string | null;
  color: string | null;
  chapter: string | null;
  layer: "club" | "friend" | "public";
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: { spoiler: boolean; ahead: boolean };
  author: AnnotationAuthor;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
}

export interface ReaderComment {
  id: string;
  clubId: string | null;
  parentId: string | null;
  locator: Locator | null;
  body: string | null;
  chapter: string | null;
  isPinned: boolean;
  containsSpoilers: boolean;
  gate: { spoiler: boolean; ahead: boolean };
  author: AnnotationAuthor;
  createdAt: string | number | Date;
}

export interface ReaderPopular {
  normalizedText: string;
  count: number;
  locator: Locator | null;
}

// Which social layers the reader shows. Persisted per user in localStorage; mine is on
// by default, the social layers off (opt-in), so the reader opens as a private surface.
type LayerState = { mine: boolean; clubs: boolean; everyone: boolean };
const DEFAULT_LAYERS: LayerState = { mine: true, clubs: false, everyone: false };
const LAYERS_KEY = "foxing.reader.layers";

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

const SETTINGS_KEY = "foxing.reader.settings";
const PROGRESS_DEBOUNCE = 1500;

// "My clubs" shows club + friend layers; "Everyone" shows public. Popular follows
// "Everyone" too. One place decides the mapping so the toggles and the redraw agree.
function layerShown(layer: ReaderOther["layer"], state: LayerState): boolean {
  if (layer === "public") return state.everyone;
  return state.clubs; // club | friend
}

function loadLayers(): LayerState {
  if (typeof localStorage === "undefined") return DEFAULT_LAYERS;
  try {
    const raw = localStorage.getItem(LAYERS_KEY);
    return raw ? { ...DEFAULT_LAYERS, ...JSON.parse(raw) } : DEFAULT_LAYERS;
  } catch {
    return DEFAULT_LAYERS;
  }
}

// Semantic meaning per color (design-system.md) doubles as the non-color signal
// (system Rule 01) and the accessible label.
const COLOR_MEANING: Record<HighlightColor, string> = {
  amber: "Key ideas",
  auburn: "Emotional",
  yellow: "Important",
  sage: "Love it",
  cobalt: "Research",
  crimson: "Question",
  purple: "Disagree",
};

// Two locators point at the same reading position when they share a resource and
// their progression matches within a hair. Used to skip redundant progress saves,
// which otherwise fire (and flash "Saving...") for the position we just restored.
function samePosition(a: Locator | null, b: Locator | null): boolean {
  if (!a || !b || a.href !== b.href) return false;
  return Math.abs(progressionOf(a) - progressionOf(b)) < 1e-4;
}

function progressionOf(loc: Locator): number {
  const l = loc.locations ?? {};
  const v = typeof l.totalProgression === "number" ? l.totalProgression : l.progression;
  return typeof v === "number" ? v : 0;
}

// The engine keeps a pool of content frames (current, prev, next); only one is
// shown at a time, the rest are hidden (visibility:hidden, opacity:0). Activation
// rects are relative to the shown frame, so anchor against that one.
function visibleFrame(container: HTMLElement | null): HTMLIFrameElement | null {
  if (!container) return null;
  const frames = Array.from(container.querySelectorAll("iframe"));
  return (
    frames.find((f) => f.style.visibility !== "hidden" && f.style.opacity !== "0") ??
    frames[0] ??
    null
  );
}

function loadSettings(): ReaderSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
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
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

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
    (async () => {
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

  // The single browser write seam. Every personal-feature write goes to /api/v1
  // (the standing transport rule) and surfaces its own failure; nothing is swallowed.
  // Returns the Response on success, null on failure (with writeError already set).
  const apiWrite = useCallback(
    async (path: string, opts: { method: string; body?: unknown }): Promise<Response | null> => {
      setSaving(true);
      setWriteError(null);
      try {
        const res = await fetch(`/api/v1${path}`, {
          method: opts.method,
          headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          setWriteError(data?.error?.message ?? `Could not save (${res.status}). Try again.`);
          return null;
        }
        return res;
      } catch {
        setWriteError("Could not reach the server. Check your connection and try again.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

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
      {/* Top bar */}
      <header
        className="flex items-center gap-2 border-b border-border-subtle px-3 py-2"
        style={{ background: canvas.bg }}
      >
        <Link
          to={`/books/${book.slug}`}
          className="rounded-md px-2 py-1 text-sm hover:underline"
          aria-label="Back to book page"
        >
          ‹ Back
        </Link>
        <div className="min-w-0 flex-1 truncate text-center text-sm">
          <span className="font-display">{book.title}</span>
          {chapter ? (
            <span className="text-[color-mix(in_srgb,currentColor_60%,transparent)]">
              {" "}
              {"·"} {chapter}
            </span>
          ) : null}
        </div>
        <ChromeButton
          onClick={() => setPanel(panel === "toc" ? null : "toc")}
          pressed={panel === "toc"}
          label="Contents"
        >
          Contents
        </ChromeButton>
        <ChromeButton
          onClick={() => setPanel(panel === "type" ? null : "type")}
          pressed={panel === "type"}
          label="Text settings"
        >
          Aa
        </ChromeButton>
        <ChromeButton onClick={addBookmark} label="Add bookmark">
          Bookmark
        </ChromeButton>
      </header>

      {/* Social layer toggles: read your book with optional social layers overlaid. */}
      {/* biome-ignore lint/a11y/useSemanticElements: a toggle bar of buttons, not a form fieldset */}
      <div
        className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs"
        style={{ background: canvas.bg }}
        role="group"
        aria-label="Reading layers"
      >
        <span className="text-[color-mix(in_srgb,currentColor_55%,transparent)]">Layers</span>
        <LayerChip label="Mine" on={layers.mine} onClick={() => toggleLayer("mine")} />
        <LayerChip
          label="My clubs"
          on={layers.clubs}
          count={others.filter((o) => o.layer !== "public").length}
          onClick={() => toggleLayer("clubs")}
        />
        <LayerChip
          label="Everyone"
          on={layers.everyone}
          count={others.filter((o) => o.layer === "public").length + props.popular.length}
          onClick={() => toggleLayer("everyone")}
        />
      </div>

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
          <nav aria-label="Table of contents">
            <ul className="flex flex-col gap-0.5">
              {toc.map((t) => (
                <li key={t.href}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
                    onClick={() => {
                      engineRef.current?.goToHref(t.href);
                      setPanel(null);
                    }}
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {bookmarks.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-xs uppercase tracking-wider text-tertiary">Bookmarks</h3>
              <ul className="flex flex-col gap-0.5">
                {bookmarks.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
                      onClick={() => {
                        if (b.locator) engineRef.current?.goToLocator(b.locator);
                        setPanel(null);
                      }}
                    >
                      {b.chapter ?? "Bookmark"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs text-tertiary hover:underline"
                      onClick={() => deleteAnnotation(b.id)}
                      aria-label="Remove bookmark"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {marks.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-xs uppercase tracking-wider text-tertiary">
                Highlights & notes
              </h3>
              <ul className="flex flex-col gap-1">
                {marks.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
                      onClick={() => openMark(a)}
                    >
                      <span
                        className="mt-1 h-3 w-3 flex-none rounded-full border border-border-default"
                        style={{
                          background: tintFor((a.color as HighlightColor) ?? "amber", "light"),
                        }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        {a.selectedText ? (
                          <span className="line-clamp-2 text-sm">{a.selectedText}</span>
                        ) : null}
                        {a.body ? (
                          <span className="mt-0.5 flex items-start gap-1 text-xs text-tertiary">
                            <span className="rounded bg-hover px-1 font-medium">Note</span>
                            <span className="line-clamp-2">{a.body}</span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SidePanel>
      ) : null}

      {panel === "type" ? (
        <SidePanel title="Text settings" onClose={() => setPanel(null)} canvas={canvas}>
          <TypographyControls settings={settings} onChange={updateSettings} />
        </SidePanel>
      ) : null}

      {signInPrompt ? (
        <Modal onClose={() => setSignInPrompt(false)} title="Sign in to save">
          <p className="text-sm text-secondary">
            Reading is free. Sign in to keep highlights, notes, bookmarks, and your place.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              to={loginHref}
              className="rounded-md bg-[color:var(--brand-ui)] px-4 py-2 text-sm text-[color:var(--text-on-brand)]"
            >
              Sign in
            </Link>
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm hover:bg-hover"
              onClick={() => setSignInPrompt(false)}
            >
              Keep reading
            </button>
          </div>
        </Modal>
      ) : null}

      {saving ? (
        <p
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-surface/95 px-3 py-1.5 font-ui text-xs text-tertiary shadow-md"
          role="status"
        >
          Saving...
        </p>
      ) : null}

      {writeError ? (
        <div
          className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md border border-error-border bg-surface px-3 py-2 font-ui text-xs text-error shadow-md"
          role="alert"
        >
          <span>{writeError}</span>
          <button
            type="button"
            className="font-medium text-tertiary underline underline-offset-2"
            onClick={() => setWriteError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ChromeButton({
  children,
  onClick,
  pressed,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      // Border/hover/pressed derive from currentColor (the reading theme's text)
      // so the button always contrasts with its canvas; the old site tokens
      // (border-subtle/hover/selected) went dark-on-dark on the dark reading canvas.
      className="rounded-md border border-[color-mix(in_srgb,currentColor_32%,transparent)] px-3 py-1 text-sm hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] aria-pressed:bg-[color-mix(in_srgb,currentColor_20%,transparent)]"
    >
      {children}
    </button>
  );
}

function LayerChip({
  label,
  on,
  count,
  onClick,
}: {
  label: string;
  on: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="rounded-full border border-[color-mix(in_srgb,currentColor_28%,transparent)] px-2 py-0.5 hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] aria-pressed:border-[color:var(--brand-ui)] aria-pressed:bg-[color:var(--brand-ui)] aria-pressed:text-[color:var(--text-on-brand)]"
    >
      {label}
      {count ? <span className="ml-1 opacity-70 tabular-nums">{count}</span> : null}
    </button>
  );
}

function authorName(a: AnnotationAuthor): string {
  return a.displayName ?? a.username ?? "A reader";
}

// Attribution popover for another reader's shared annotation. Anchors to the tapped
// passage (same math as EditPopover). Shows the author, their note (spoiler/progress
// gated with a reveal), a like control, and the reply thread with a composer. Replies
// post into a shared club; a picker appears only when more than one club is shared.
function AttributionPopover({
  other,
  anchor,
  canvas,
  replies,
  revealed,
  progressGateEnabled,
  shareableClubs,
  onReveal,
  onToggleLike,
  onReply,
  onClose,
}: {
  other: ReaderOther;
  anchor: DecorationRect | null;
  canvas: { bg: string; text: string };
  replies: ReaderComment[];
  revealed: boolean;
  progressGateEnabled: boolean;
  shareableClubs: { id: string; name: string }[];
  onReveal: () => void;
  onToggleLike: () => void;
  onReply: (clubId: string, body: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [clubId, setClubId] = useState(shareableClubs[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Re-measure when the popover's content changes size (a reply typed, the note
  // revealed, a reply added), so it stays anchored to the passage.
  // biome-ignore lint/correctness/useExhaustiveDependencies: content-size triggers are intentional re-measures
  useLayoutEffect(() => {
    if (!anchor || !ref.current) {
      setPos(null);
      return;
    }
    const pad = 8;
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const centerX = anchor.left + anchor.width / 2;
    const left = Math.max(pad, Math.min(centerX - w / 2, window.innerWidth - w - pad));
    const below = anchor.top + anchor.height + pad;
    const top = below + h + pad <= window.innerHeight ? below : Math.max(pad, anchor.top - h - pad);
    setPos({ top, left });
  }, [anchor, replyText, revealed, replies.length]);

  const gated = other.gate.spoiler || (progressGateEnabled && other.gate.ahead);
  const gateLabel = other.gate.spoiler ? "Contains spoilers" : "Ahead of where you are";
  const canReply = shareableClubs.length > 0;
  const anchored = anchor != null;

  const submit = async () => {
    const body = replyText.trim();
    if (!body || !clubId) return;
    setBusy(true);
    const ok = await onReply(clubId, body);
    setBusy(false);
    if (ok) setReplyText("");
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Annotation by ${authorName(other.author)}`}
      className={`z-30 w-[min(30rem,92vw)] rounded-card border border-border-subtle p-3 shadow-lg ${
        anchored ? "fixed" : "fixed bottom-16 left-1/2 -translate-x-1/2"
      }`}
      style={
        anchored
          ? pos
            ? { top: pos.top, left: pos.left, background: canvas.bg, color: canvas.text }
            : { top: 0, left: 0, visibility: "hidden", background: canvas.bg, color: canvas.text }
          : { background: canvas.bg, color: canvas.text }
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid h-6 w-6 flex-none place-items-center rounded-full border border-border-default text-xs font-medium"
          style={{ background: tintFor((other.color as HighlightColor) ?? "amber", "light") }}
          aria-hidden
        >
          {authorName(other.author).charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {authorName(other.author)}
        </span>
        {other.isPinned ? (
          <span className="rounded bg-hover px-1 text-[10px] uppercase tracking-wide text-tertiary">
            Pinned
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md px-1.5 py-0.5 text-sm hover:bg-hover"
        >
          ✕
        </button>
      </div>

      {other.selectedText ? (
        <p className="mb-2 max-h-24 overflow-auto text-sm italic opacity-70">
          “{other.selectedText}”
        </p>
      ) : null}

      {other.body ? (
        gated && !revealed ? (
          <button
            type="button"
            onClick={onReveal}
            className="mb-2 w-full rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-tertiary hover:bg-hover"
          >
            <span className="font-medium">{gateLabel}.</span> Tap to reveal.
          </button>
        ) : (
          <p className="mb-2 whitespace-pre-wrap text-sm">{other.body}</p>
        )
      ) : null}

      <div className="mb-2 flex items-center gap-3 text-xs text-tertiary">
        <button
          type="button"
          aria-pressed={other.likedByMe}
          onClick={onToggleLike}
          className="rounded-full px-2 py-0.5 hover:bg-hover aria-pressed:text-[color:var(--brand-text)]"
        >
          {other.likedByMe ? "Liked" : "Like"}
          {other.likeCount > 0 ? (
            <span className="ml-1 tabular-nums">{other.likeCount}</span>
          ) : null}
        </button>
        <span className="tabular-nums">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </span>
      </div>

      {replies.length > 0 ? (
        <ul className="mb-2 flex max-h-40 flex-col gap-1.5 overflow-auto">
          {replies.map((r) => (
            <li key={r.id} className="rounded-md bg-hover px-2 py-1.5 text-sm">
              <span className="mr-1 font-medium">{authorName(r.author)}:</span>
              <span>{r.body}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {canReply ? (
        <div className="flex flex-col gap-1.5">
          {shareableClubs.length > 1 ? (
            <select
              aria-label="Reply in club"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="rounded-md border border-border-subtle bg-base p-1.5 text-sm text-primary"
            >
              {shareableClubs.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply to this passage"
            className="h-16 w-full resize-none rounded-md border border-border-subtle bg-base p-2 text-sm text-primary"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy || !replyText.trim()}
              onClick={submit}
              className="rounded-md bg-[color:var(--brand-ui)] px-3 py-1.5 text-sm text-[color:var(--text-on-brand)] disabled:opacity-50"
            >
              Reply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectionToolbar({
  onColor,
  onNote,
  onDismiss,
  canvas,
  canShareToClub,
}: {
  onColor: (c: HighlightColor, shareToClub: boolean) => void;
  onNote: () => void;
  onDismiss: () => void;
  canvas: { bg: string; text: string };
  canShareToClub: boolean;
}) {
  // When on, the next color tap saves the highlight with club visibility. Explicit,
  // per-annotation opt-in: nothing is club-shared by surprise.
  const [share, setShare] = useState(false);
  return (
    <div
      role="toolbar"
      aria-label="Highlight selection"
      className="fixed bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-subtle px-3 py-2 shadow-md"
      style={{ background: canvas.bg, color: canvas.text }}
    >
      {highlightColorValues.map((c) => (
        <button
          key={c}
          type="button"
          title={`${c}: ${COLOR_MEANING[c]}`}
          aria-label={`Highlight: ${COLOR_MEANING[c]}`}
          onClick={() => onColor(c, share)}
          className="h-6 w-6 rounded-full border border-border-default"
          style={{ background: tintFor(c, "light") }}
        />
      ))}
      <span className="mx-1 h-5 w-px bg-border-default" aria-hidden />
      <button
        type="button"
        onClick={onNote}
        className="rounded-full px-2 py-1 text-sm hover:bg-hover"
      >
        Note
      </button>
      {canShareToClub ? (
        <button
          type="button"
          aria-pressed={share}
          onClick={() => setShare((s) => !s)}
          className="rounded-full px-2 py-1 text-sm hover:bg-hover aria-pressed:bg-[color:var(--brand-ui)] aria-pressed:text-[color:var(--text-on-brand)]"
        >
          Share to club
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-full px-2 py-1 text-sm hover:bg-hover"
      >
        ✕
      </button>
    </div>
  );
}

function NoteComposer({
  draft,
  onChange,
  onSave,
  onCancel,
  canvas,
  canShareToClub,
}: {
  draft: { color: HighlightColor; text: string };
  onChange: (d: { color: HighlightColor; text: string }) => void;
  onSave: (shareToClub: boolean) => void;
  onCancel: () => void;
  canvas: { bg: string; text: string };
  canShareToClub: boolean;
}) {
  const [share, setShare] = useState(false);
  return (
    <div
      className="fixed bottom-16 left-1/2 z-20 w-[min(28rem,90vw)] -translate-x-1/2 rounded-card border border-border-subtle p-3 shadow-lg"
      style={{ background: canvas.bg, color: canvas.text }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {highlightColorValues.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color: ${COLOR_MEANING[c]}`}
            aria-pressed={draft.color === c}
            onClick={() => onChange({ ...draft, color: c })}
            className="h-5 w-5 rounded-full border border-border-default aria-pressed:ring-2 aria-pressed:ring-[color:var(--border-focus)]"
            style={{ background: tintFor(c, "light") }}
          />
        ))}
      </div>
      <textarea
        // biome-ignore lint/a11y/noAutofocus: composer opens on explicit user action
        autoFocus
        value={draft.text}
        onChange={(e) => onChange({ ...draft, text: e.target.value })}
        placeholder="Add a note"
        className="h-24 w-full resize-none rounded-md border border-border-subtle bg-base p-2 text-sm text-primary"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        {canShareToClub ? (
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            Share to club
          </label>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(share)}
            className="rounded-md bg-[color:var(--brand-ui)] px-3 py-1.5 text-sm text-[color:var(--text-on-brand)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPopover({
  annotation,
  anchor,
  canvas,
  onColor,
  onSaveNote,
  onDelete,
  onClose,
}: {
  annotation: ReaderAnnotation;
  anchor: DecorationRect | null;
  canvas: { bg: string; text: string };
  onColor: (c: HighlightColor) => void;
  onSaveNote: (body: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState(annotation.body ?? "");
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Anchor to the tapped passage: centered under it, flipped above when there is
  // no room below, clamped to the viewport. Measured post-render so the popover's
  // real size is used; hidden until measured to avoid a flash at the origin.
  useLayoutEffect(() => {
    if (!anchor || !ref.current) {
      setPos(null);
      return;
    }
    const pad = 8;
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const centerX = anchor.left + anchor.width / 2;
    const left = Math.max(pad, Math.min(centerX - w / 2, window.innerWidth - w - pad));
    const below = anchor.top + anchor.height + pad;
    const top = below + h + pad <= window.innerHeight ? below : Math.max(pad, anchor.top - h - pad);
    setPos({ top, left });
  }, [anchor, body]);

  const anchored = anchor != null;
  // No full-screen backdrop: it would intercept every reader click and read as a
  // frozen page. The popover closes on Close, Escape, a page turn, or opening
  // another annotation, so reading interaction is never blocked.
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Edit annotation"
      className={`z-30 w-[min(28rem,90vw)] rounded-card border border-border-subtle p-3 shadow-lg ${
        anchored ? "fixed" : "fixed bottom-16 left-1/2 -translate-x-1/2"
      }`}
      style={
        anchored
          ? pos
            ? { top: pos.top, left: pos.left, background: canvas.bg, color: canvas.text }
            : { top: 0, left: 0, visibility: "hidden", background: canvas.bg, color: canvas.text }
          : { background: canvas.bg, color: canvas.text }
      }
    >
      <div className="mb-2 flex items-center gap-1.5">
        {highlightColorValues.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color: ${COLOR_MEANING[c]}`}
            aria-pressed={annotation.color === c}
            onClick={() => onColor(c)}
            className="h-5 w-5 rounded-full border border-border-default aria-pressed:ring-2 aria-pressed:ring-[color:var(--border-focus)]"
            style={{ background: tintFor(c, "light") }}
          />
        ))}
      </div>
      {annotation.selectedText ? (
        <p className="mb-2 max-h-20 overflow-auto text-sm italic opacity-70">
          “{annotation.selectedText}”
        </p>
      ) : null}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note"
        className="h-20 w-full resize-none rounded-md border border-border-subtle bg-base p-2 text-sm text-primary"
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-3 py-1.5 text-sm text-[color:var(--error)] hover:underline"
        >
          Delete
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-hover"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onSaveNote(body.trim())}
            className="rounded-md bg-[color:var(--brand-ui)] px-3 py-1.5 text-sm text-[color:var(--text-on-brand)]"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  title,
  children,
  onClose,
  canvas,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  canvas: { bg: string; text: string };
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-20 bg-[color:var(--overlay)]"
        onClick={onClose}
      />
      <aside
        // Themed with the reading canvas (not site tokens): the reader root sets an
        // inline text color per reading theme, so a site-surface panel would show
        // light text on a light panel in dark theme.
        className="fixed right-0 top-0 z-30 flex h-full w-[min(22rem,90vw)] flex-col border-l border-border-subtle"
        style={{ background: canvas.bg, color: canvas.text }}
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          {/* text-inherit so the reading-canvas color wins over the global h2 rule
              (var(--text-primary)), which would be near-black on a dark panel. */}
          <h2 className="font-display text-lg text-inherit">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 hover:bg-hover"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3">{children}</div>
      </aside>
    </>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-30 bg-[color:var(--overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="fixed left-1/2 top-1/2 z-40 w-[min(26rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border-subtle bg-surface p-5 shadow-lg"
      >
        <h2 className="mb-2 font-display text-xl">{title}</h2>
        {children}
      </div>
    </>
  );
}

function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
          className="h-7 w-7 rounded-md border border-border-subtle disabled:opacity-40"
        >
          −
        </button>
        <span className="w-12 text-center text-sm tabular-nums">{display}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}
          className="h-7 w-7 rounded-md border border-border-subtle disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function TypographyControls({
  settings,
  onChange,
}: {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
}) {
  const themes: ReaderTheme[] = ["light", "sepia", "dark"];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-xs uppercase tracking-wider text-tertiary">Theme</span>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={settings.theme === t}
              onClick={() => onChange({ theme: t })}
              className="flex-1 rounded-md border border-border-subtle px-3 py-2 text-sm capitalize aria-pressed:border-border-interactive aria-pressed:bg-selected"
              style={{ background: READING_CANVAS[t].bg, color: READING_CANVAS[t].text }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Stepper
        label="Font size"
        value={settings.fontSize}
        display={`${Math.round(settings.fontSize * 100)}%`}
        min={FONT_SIZE_RANGE.min}
        max={FONT_SIZE_RANGE.max}
        step={FONT_SIZE_RANGE.step}
        onChange={(v) => onChange({ fontSize: v })}
      />
      <Stepper
        label="Line height"
        value={settings.lineHeight}
        display={settings.lineHeight.toFixed(1)}
        min={LINE_HEIGHT_RANGE.min}
        max={LINE_HEIGHT_RANGE.max}
        step={LINE_HEIGHT_RANGE.step}
        onChange={(v) => onChange({ lineHeight: v })}
      />
      <Stepper
        label="Margins"
        value={settings.margin}
        display={`${settings.margin}`}
        min={MARGIN_RANGE.min}
        max={MARGIN_RANGE.max}
        step={MARGIN_RANGE.step}
        onChange={(v) => onChange({ margin: v })}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm">Scroll</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.scroll}
          aria-label="Scroll mode"
          onClick={() => onChange({ scroll: !settings.scroll })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            settings.scroll ? "bg-[color:var(--brand-ui)]" : "bg-border-strong"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition-transform ${
              settings.scroll ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {!settings.scroll ? (
        <div className="flex items-center justify-between">
          <span className="text-sm">Columns</span>
          <div className="flex gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={settings.columns === n}
                onClick={() => onChange({ columns: n as 1 | 2 })}
                // Selected: a brand fill with on-brand text, which reads clearly on
                // every reading canvas. The old bg-selected token is a site light
                // tint, invisible under the panel's inherited (light) text in dark.
                // Arbitrary values (not bg-brand-ui, which is not a mapped token).
                className="h-7 w-10 rounded-md border border-border-subtle text-sm aria-pressed:border-[color:var(--brand-ui)] aria-pressed:bg-[color:var(--brand-ui)] aria-pressed:text-[color:var(--text-on-brand)]"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
