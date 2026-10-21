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

export function ChromeButton({
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

export function LayerChip({
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
      className="rounded-full border border-[color-mix(in_srgb,currentColor_28%,transparent)] px-2 py-0.5 hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] aria-pressed:border-[color:var(--border-brand)] aria-pressed:bg-[color:var(--brand-subtle)] aria-pressed:text-[color:var(--brand-subtle-text)]"
    >
      {label}
      {count ? <span className="ml-1 tabular-nums">{count}</span> : null}
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

export function TypographyControls({
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
                // Selected: the brand-subtle fill with its own text colour, so it
                // reads on every reading canvas (the panel's inherited text is not
                // used). White on brand-ui is 3.76:1, under WCAG AA for this size.
                // The old bg-selected token is a site light tint, invisible under the
                // panel's inherited (light) text in dark.
                className="h-7 w-10 rounded-md border border-border-subtle text-sm aria-pressed:border-[color:var(--border-brand)] aria-pressed:bg-[color:var(--brand-subtle)] aria-pressed:text-[color:var(--brand-subtle-text)]"
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
        <ul className="flex flex-col gap-0.5">
          {toc.map((t) => (
            <li key={t.href}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
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
          <h3 className="mb-2 text-xs uppercase tracking-wider text-tertiary">Bookmarks</h3>
          <ul className="flex flex-col gap-0.5">
            {bookmarks.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-hover"
                  onClick={() => onGoToLocator(b.locator)}
                >
                  {b.chapter ?? "Bookmark"}
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-tertiary hover:underline"
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
          <h3 className="mb-2 text-xs uppercase tracking-wider text-tertiary">
            Highlights & notes
          </h3>
          <ul className="flex flex-col gap-1">
            {marks.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
                  onClick={() => onOpenMark(a)}
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
    </>
  );
}

export function SignInPrompt({ loginHref, onClose }: { loginHref: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="Sign in to save">
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
          onClick={onClose}
        >
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
            onClick={onDismiss}
          >
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
      <header
        className="flex items-center gap-2 border-b border-border-subtle px-3 py-2"
        style={{ background }}
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
        className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs"
        style={{ background }}
        role="group"
        aria-label="Reading layers"
      >
        <span className="text-[color-mix(in_srgb,currentColor_70%,transparent)]">Layers</span>
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
