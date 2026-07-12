// The reading surface. Renders a shell on the server and mounts the Readium
// engine client-side (lazy import, so ts-toolkit never loads on catalog pages or
// during SSR). Owns navigation, TOC, the progress scrubber, typography controls,
// keyboard nav, and annotations (7-color highlights, notes, bookmarks). Writes go
// to /api/v1 (annotations + progress) from the browser and surface every failure;
// anonymous readers can read fully and are prompted to sign in for personal features.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { HighlightColor } from "@foxing/core";
import { highlightColorValues } from "@foxing/core";
import type {
  CreateEngineOptions,
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

interface ReaderViewProps {
  book: { id: string; slug: string; title: string; author: string };
  manifestUrl: string;
  signedIn: boolean;
  loginHref: string;
  annotations: ReaderAnnotation[];
  initialLocator: Locator | null;
}

const SETTINGS_KEY = "foxing.reader.settings";
const PROGRESS_DEBOUNCE = 1500;

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
  const { book, manifestUrl, signedIn, loginHref, initialLocator } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReaderEngine | null>(null);
  const currentLocatorRef = useRef<Locator | null>(initialLocator);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last position we actually persisted (seeded with the restored one), so we never
  // re-save an unchanged position. A ms timestamp of the last in-text highlight tap,
  // so a stray word-selection from the same tap can't immediately close the popover.
  const lastSavedRef = useRef<Locator | null>(initialLocator);
  const lastActivationRef = useRef(0);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>(props.annotations);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [pct, setPct] = useState(progressPctFromLocator(initialLocator));
  const [chapter, setChapter] = useState("");
  const [panel, setPanel] = useState<"toc" | "type" | null>(null);
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ color: HighlightColor; text: string } | null>(null);
  const [editing, setEditing] = useState<ReaderAnnotation | null>(null);
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

  const reapplyHighlights = useCallback((list: ReaderAnnotation[], theme: ReaderTheme) => {
    const specs = list
      .filter((a) => (a.type === "highlight" || a.type === "note") && a.locator)
      .map((a) => ({
        id: a.id,
        locator: a.locator as Locator,
        color: (a.color as HighlightColor) ?? "amber",
      }));
    engineRef.current?.applyHighlights(specs, theme);
  }, []);

  // Boot: load saved settings, build the engine, wire listeners. Mounts once per
  // book; all inputs it needs (signedIn, initialLocator, the callbacks) are stable
  // for a reading session or read through refs, so re-running on their identity
  // would needlessly rebuild the navigator.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once per book; inputs are session-stable or ref-read
  useEffect(() => {
    const initial = loadSettings();
    setSettings(initial);
    settingsRef.current = initial;

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
              if (signedIn) scheduleSave(loc);
            },
            onSelection: (payload) => {
              // Tapping a highlight can also register a word-selection in some
              // engines, which would immediately close the note popover we just
              // opened. Ignore a selection that lands right after an activation.
              if (Date.now() - lastActivationRef.current < 500) return;
              setEditing(null);
              setSelection(payload);
            },
            onDecorationActivated: (id) => {
              lastActivationRef.current = Date.now();
              const found = annotationsRef.current.find((a) => a.id === id);
              if (found) {
                setSelection(null);
                setEditing(found);
                clearNativeSelection();
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
        // Render the user's saved highlights/notes now that engineRef is set:
        // applyHighlights goes through engineRef, and onReady fires from inside
        // createEngine (before this assignment), so re-applying here is what makes
        // saved annotations reappear on reload.
        reapplyHighlights(annotationsRef.current, settingsRef.current.theme);
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
      if (panel || noteDraft || editing || signInPrompt) return;
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
  }, [panel, noteDraft, editing, signInPrompt]);

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
        if (patch.theme) reapplyHighlights(annotationsRef.current, next.theme);
        return next;
      });
    },
    [reapplyHighlights],
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
        reapplyHighlights(next, settingsRef.current.theme);
        return next;
      });
      return optimistic;
    },
    [book.id, apiWrite, reapplyHighlights],
  );

  const highlightSelection = useCallback(
    async (color: HighlightColor, body?: string) => {
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
      });
      setSelection(null);
      setNoteDraft(null);
      clearNativeSelection();
    },
    [selection, requireSignIn, persistAnnotation, clearNativeSelection],
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
        reapplyHighlights(next, settingsRef.current.theme);
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
        reapplyHighlights(next, settingsRef.current.theme);
        return next;
      });
      setEditing(null);
    },
    [apiWrite, reapplyHighlights],
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
          {chapter ? <span className="text-tertiary"> {"·"} {chapter}</span> : null}
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
        <label className="flex items-center gap-3 text-xs text-tertiary">
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
          onColor={(c) => highlightSelection(c)}
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
          onChange={setNoteDraft}
          onSave={() => highlightSelection(noteDraft.color, noteDraft.text.trim() || undefined)}
          onCancel={() => {
            setNoteDraft(null);
            setSelection(null);
            clearNativeSelection();
          }}
        />
      ) : null}

      {/* Edit popover for an existing highlight/note */}
      {editing ? (
        <EditPopover
          annotation={editing}
          onColor={(c) => patchAnnotation(editing.id, { color: c })}
          onSaveNote={(body) => patchAnnotation(editing.id, { body: body || null })}
          onDelete={() => deleteAnnotation(editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {panel === "toc" ? (
        <SidePanel title="Contents" onClose={() => setPanel(null)}>
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
        <SidePanel title="Text settings" onClose={() => setPanel(null)}>
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
      className="rounded-md border border-border-subtle px-3 py-1 text-sm hover:bg-hover aria-pressed:bg-selected"
    >
      {children}
    </button>
  );
}

function SelectionToolbar({
  onColor,
  onNote,
  onDismiss,
}: {
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Highlight selection"
      className="fixed bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-2 shadow-md"
    >
      {highlightColorValues.map((c) => (
        <button
          key={c}
          type="button"
          title={`${c}: ${COLOR_MEANING[c]}`}
          aria-label={`Highlight: ${COLOR_MEANING[c]}`}
          onClick={() => onColor(c)}
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
}: {
  draft: { color: HighlightColor; text: string };
  onChange: (d: { color: HighlightColor; text: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-16 left-1/2 z-20 w-[min(28rem,90vw)] -translate-x-1/2 rounded-card border border-border-subtle bg-surface p-3 shadow-lg">
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
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-[color:var(--brand-ui)] px-3 py-1.5 text-sm text-[color:var(--text-on-brand)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function EditPopover({
  annotation,
  onColor,
  onSaveNote,
  onDelete,
  onClose,
}: {
  annotation: ReaderAnnotation;
  onColor: (c: HighlightColor) => void;
  onSaveNote: (body: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState(annotation.body ?? "");
  return (
    <div className="fixed bottom-16 left-1/2 z-20 w-[min(28rem,90vw)] -translate-x-1/2 rounded-card border border-border-subtle bg-surface p-3 shadow-lg">
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
        <p className="mb-2 max-h-20 overflow-auto text-sm italic text-secondary">
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
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
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
        className="fixed right-0 top-0 z-30 flex h-full w-[min(22rem,90vw)] flex-col border-l border-border-subtle bg-surface"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="font-display text-lg">{title}</h2>
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
          className="h-6 w-11 rounded-full border border-border-default transition-colors aria-checked:bg-[color:var(--toggle-on)]"
        >
          <span
            className="block h-5 w-5 rounded-full bg-surface shadow-sm transition-transform"
            style={{ transform: settings.scroll ? "translateX(1.25rem)" : "translateX(1px)" }}
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
                className="h-7 w-10 rounded-md border border-border-subtle text-sm aria-pressed:bg-selected"
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
