import { type HighlightColor, highlightColorValues } from "@foxing/core";
import type {
  AnnotationAuthor,
  ReaderAnnotation,
  ReaderComment,
  ReaderOther,
} from "./reader-types";
import type { DecorationRect } from "~/lib/reader/engine.client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { tintFor } from "~/lib/reader/locator";

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

function authorName(a: AnnotationAuthor): string {
  return a.displayName ?? a.username ?? "A reader";
}

// Attribution popover for another reader's shared annotation. Anchors to the tapped
// passage (same math as EditPopover). Shows the author, their note (spoiler/progress
// gated with a reveal), a like control, and the reply thread with a composer. Replies
// post into a shared club; a picker appears only when more than one club is shared.
export function AttributionPopover({
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

export function SelectionToolbar({
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
          className="rounded-full px-2 py-1 text-sm hover:bg-hover aria-pressed:bg-[color:var(--brand-subtle)] aria-pressed:text-[color:var(--brand-subtle-text)]"
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

export function NoteComposer({
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

export function EditPopover({
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
  }, [anchor]);

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
