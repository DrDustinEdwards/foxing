import type { HighlightColor } from "@foxing/core";
import { Link } from "react-router";
import type { TocEntry } from "~/lib/reader/engine.client";
import { type Locator, tintFor } from "~/lib/reader/locator";
import {
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  MARGIN_RANGE,
  type ReaderSettings,
  type ReaderTheme,
  READING_CANVAS,
} from "~/lib/reader/settings";
import type { LayerState, ReaderAnnotation } from "./reader-types";

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
      // Border/hover/pressed derive from currentColor (the reading theme's text) so the
      // button always contrasts with its canvas, whatever the site theme.
      className="fx-reader-toggle"
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
    <button type="button" aria-pressed={on} onClick={onClick} className="fx-reader-layer">
      {label}
      {count ? <span className="fx-reader-panels-label">{count}</span> : null}
    </button>
  );
}

export function SidePanel({
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
        className="fx-reader-panels-btn"
        onClick={onClose}
      />
      <aside
        // Themed with the reading canvas (not site tokens): the reader root sets an
        // inline text color per reading theme, so a site-surface panel would show
        // light text on a light panel in dark theme.
        className="fx-reader-panels-aside"
        style={{ background: canvas.bg, color: canvas.text }}
        aria-label={title}
      >
        <div className="py-3 fx-reader-panels-row">
          {/* text-inherit so the reading-canvas color wins over the global h2 rule
              (var(--text-primary)), which would be near-black on a dark panel. */}
          <h2 className="fx-reader-panels-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="fx-reader-panels-btn-2"
          >
            ✕
          </button>
        </div>
        <div className="fx-reader-panels-box">{children}</div>
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
        className="fx-reader-panels-btn-3"
        onClick={onClose}
      />
      <div role="dialog" aria-modal aria-label={title} className="fx-reader-panels-card">
        <h2 className="mb-2 fx-reader-panels-title-2">{title}</h2>
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
    <div className="row spread">
      <span className="fx-reader-panels-label-2">{label}</span>
      <div className="row-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
          className="fx-reader-panels-btn-4"
        >
          −
        </button>
        <span className="text-center fx-reader-panels-label-3">{display}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}
          className="fx-reader-panels-btn-4"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TypographyControls({
  settings,
  onChange,
}: {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
}) {
  const themes: ReaderTheme[] = ["light", "sepia", "dark"];
  return (
    <div className="stack">
      <div>
        <span className="mb-2 block fx-reader-panels-label-4">Theme</span>
        <div className="row-2">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={settings.theme === t}
              onClick={() => onChange({ theme: t })}
              className="fx-reader-theme"
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

      <div className="row spread">
        <span className="fx-reader-panels-label-2">Scroll</span>
        <label className="cap-switch">
          <input
            type="checkbox"
            role="switch"
            aria-checked={settings.scroll}
            aria-label="Scroll mode"
            checked={settings.scroll}
            onChange={(e) => onChange({ scroll: e.target.checked })}
          />
        </label>
      </div>

      {!settings.scroll ? (
        <div className="row spread">
          <span className="fx-reader-panels-label-2">Columns</span>
          <div className="row-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={settings.columns === n}
                onClick={() => onChange({ columns: n as 1 | 2 })}
                // Selected: the accent-soft fill with its own text color, so it reads on
                // every reading canvas (the panel's inherited text is not used).
                className="fx-reader-cols"
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

// The Contents panel body: table of contents, bookmarks, and the persistent list of
// highlights + notes (the reliable way to reopen a note).
export function ContentsList({
  toc,
  bookmarks,
  marks,
  onGoToHref,
  onGoToLocator,
  onDelete,
  onOpenMark,
}: {
  toc: TocEntry[];
  bookmarks: ReaderAnnotation[];
  marks: ReaderAnnotation[];
  onGoToHref: (href: string) => void;
  onGoToLocator: (locator: Locator | null) => void;
  onDelete: (id: string) => void;
  onOpenMark: (a: ReaderAnnotation) => void;
}) {
  return (
    <>
      <nav aria-label="Table of contents">
        <ul className="fx-reader-panels-stack">
          {toc.map((t) => (
            <li key={t.href}>
              <button
                type="button"
                className="fx-reader-panels-btn-5"
                onClick={() => onGoToHref(t.href)}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {bookmarks.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-2 fx-reader-panels-label-4">Bookmarks</h3>
          <ul className="fx-reader-panels-stack">
            {bookmarks.map((b) => (
              <li key={b.id} className="row-2">
                <button
                  type="button"
                  className="fx-reader-panels-btn-6"
                  onClick={() => onGoToLocator(b.locator)}
                >
                  {b.chapter ?? "Bookmark"}
                </button>
                <button
                  type="button"
                  className="fx-reader-panels-btn-7"
                  onClick={() => onDelete(b.id)}
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
          <h3 className="mb-2 fx-reader-panels-label-4">Highlights & notes</h3>
          <ul className="stack-1">
            {marks.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="items-start fx-reader-panels-btn-8"
                  onClick={() => onOpenMark(a)}
                >
                  <span
                    className="mt-1 fx-reader-panels-label-5"
                    style={{
                      background: tintFor((a.color as HighlightColor) ?? "amber", "light"),
                    }}
                    aria-hidden
                  />
                  <span className="fx-reader-panels-label-6">
                    {a.selectedText ? (
                      <span className="fx-reader-panels-label-7">{a.selectedText}</span>
                    ) : null}
                    {a.body ? (
                      <span className="items-start fx-reader-panels-label-8">
                        <span className="fx-reader-panels-label-9">Note</span>
                        <span className="fx-reader-panels-label-10">{a.body}</span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function SignInPrompt({ loginHref, onClose }: { loginHref: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="Sign in to save">
      <p className="small muted">
        Reading is free. Sign in to keep highlights, notes, bookmarks, and your place.
      </p>
      <div className="mt-4 fx-reader-panels-row-2">
        <Link to={loginHref} className="py-2 fx-reader-panels-link">
          Sign in
        </Link>
        <button type="button" className="py-2 fx-reader-panels-btn-9" onClick={onClose}>
          Keep reading
        </button>
      </div>
    </Modal>
  );
}

// Personal-feature writes never swallow a failure: saving drives a role="status"
// indicator, writeError a role="alert" banner.
export function WriteStatus({
  saving,
  writeError,
  onDismiss,
}: {
  saving: boolean;
  writeError: string | null;
  onDismiss: () => void;
}) {
  return (
    <>
      {saving ? (
        <p className="fx-reader-panels-text" role="status">
          Saving...
        </p>
      ) : null}

      {writeError ? (
        <div className="py-2 fx-reader-panels-card-2" role="alert">
          <span>{writeError}</span>
          <button type="button" className="fx-reader-panels-btn-10" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

// Top bar (back, title + chapter, Contents / Aa / Bookmark) and the social layer toggles.
export function ReaderTopBar({
  book,
  chapter,
  background,
  panel,
  onTogglePanel,
  onBookmark,
  layers,
  onToggleLayer,
  clubsCount,
  everyoneCount,
}: {
  book: { slug: string; title: string };
  chapter: string;
  background: string;
  panel: "toc" | "type" | null;
  onTogglePanel: (panel: "toc" | "type") => void;
  onBookmark: () => void;
  layers: LayerState;
  onToggleLayer: (key: keyof LayerState) => void;
  clubsCount: number;
  everyoneCount: number;
}) {
  return (
    <>
      {/* Top bar */}
      <header className="py-2 fx-reader-panels-row-3" style={{ background }}>
        <Link
          to={`/books/${book.slug}`}
          className="fx-reader-panels-link-2"
          aria-label="Back to book page"
        >
          ‹ Back
        </Link>
        <div className="truncate text-center fx-reader-panels-box-2">
          <span className="fx-reader-panels-title-3">{book.title}</span>
          {chapter ? (
            <span className="fx-reader-panels-label-11">
              {" "}
              {"·"} {chapter}
            </span>
          ) : null}
        </div>
        <ChromeButton
          onClick={() => onTogglePanel("toc")}
          pressed={panel === "toc"}
          label="Contents"
        >
          Contents
        </ChromeButton>
        <ChromeButton
          onClick={() => onTogglePanel("type")}
          pressed={panel === "type"}
          label="Text settings"
        >
          Aa
        </ChromeButton>
        <ChromeButton onClick={onBookmark} label="Add bookmark">
          Bookmark
        </ChromeButton>
      </header>

      {/* Social layer toggles: read your book with optional social layers overlaid. */}
      {/* biome-ignore lint/a11y/useSemanticElements: a toggle bar of buttons, not a form fieldset */}
      <div
        className="fx-reader-panels-row-4"
        style={{ background }}
        role="group"
        aria-label="Reading layers"
      >
        <span className="fx-reader-panels-label-12">Layers</span>
        <LayerChip label="Mine" on={layers.mine} onClick={() => onToggleLayer("mine")} />
        <LayerChip
          label="My clubs"
          on={layers.clubs}
          count={clubsCount}
          onClick={() => onToggleLayer("clubs")}
        />
        <LayerChip
          label="Everyone"
          on={layers.everyone}
          count={everyoneCount}
          onClick={() => onToggleLayer("everyone")}
        />
      </div>
    </>
  );
}
