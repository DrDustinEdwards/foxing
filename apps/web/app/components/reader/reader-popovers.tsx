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
    // The reply shows in the list at once, so the box empties at once too; a failed
    // write puts the text back.
    setBusy(true);
    setReplyText("");
    const ok = await onReply(clubId, body);
    setBusy(false);
    if (!ok) setReplyText(body);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Annotation by ${authorName(other.author)}`}
      className={anchored ? "fx-reader-pop" : "fx-reader-pop fx-reader-pop-docked"}
      style={
        anchored
          ? pos
            ? { top: pos.top, left: pos.left, background: canvas.bg, color: canvas.text }
            : { top: 0, left: 0, visibility: "hidden", background: canvas.bg, color: canvas.text }
          : { background: canvas.bg, color: canvas.text }
      }
    >
      <div className="mb-2 row-2">
        <span
          className="fx-reader-popovers-label"
          style={{ background: tintFor((other.color as HighlightColor) ?? "amber", "light") }}
          aria-hidden
        >
          {authorName(other.author).charAt(0).toUpperCase()}
        </span>
        <span className="truncate fx-reader-popovers-label-2">{authorName(other.author)}</span>
        {other.isPinned ? <span className="fx-reader-popovers-label-3">Pinned</span> : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="fx-reader-popovers-btn"
        >
          ✕
        </button>
      </div>

      {other.selectedText ? (
        <p className="mb-2 italic fx-reader-popovers-text">“{other.selectedText}”</p>
      ) : null}

      {other.body ? (
        gated && !revealed ? (
          <button
            type="button"
            onClick={onReveal}
            className="cap-btn mb-2 fx-reader-popovers-btn-2"
          >
            <span className="fx-reader-popovers-label-4">{gateLabel}.</span> Tap to reveal.
          </button>
        ) : (
          <p className="mb-2 fx-reader-popovers-text-2">{other.body}</p>
        )
      ) : null}

      <div className="mb-2 fx-reader-popovers-row-2">
        <button
          type="button"
          aria-pressed={other.likedByMe}
          onClick={onToggleLike}
          className="fx-reader-popovers-btn-3"
        >
          {other.likedByMe ? "Liked" : "Like"}
          {other.likeCount > 0 ? (
            <span className="fx-reader-popovers-label-5">{other.likeCount}</span>
          ) : null}
        </button>
        <span className="num">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </span>
      </div>

      {replies.length > 0 ? (
        <ul className="mb-2 fx-reader-popovers-stack">
          {replies.map((r) => (
            <li key={r.id} className="fx-reader-popovers-item">
              <span className="fx-reader-popovers-label-7">{authorName(r.author)}:</span>
              <span>{r.body}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {canReply ? (
        <div className="fx-reader-popovers-stack-2">
          {shareableClubs.length > 1 ? (
            <select
              aria-label="Reply in club"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="cap-select"
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
            className="cap-input fx-reader-popovers-btn-2"
          />
          <div className="justify-end fx-reader-popovers-row-3">
            <button
              type="button"
              disabled={busy || !replyText.trim()}
              onClick={submit}
              className="fx-reader-popovers-btn-4"
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
      className="py-2 fx-reader-popovers-row-4"
      style={{ background: canvas.bg, color: canvas.text }}
    >
      {highlightColorValues.map((c) => (
        <button
          key={c}
          type="button"
          title={`${c}: ${COLOR_MEANING[c]}`}
          aria-label={`Highlight: ${COLOR_MEANING[c]}`}
          onClick={() => onColor(c, share)}
          className="fx-reader-popovers-btn-5"
          style={{ background: tintFor(c, "light") }}
        />
      ))}
      <span className="fx-reader-popovers-label-8" aria-hidden />
      <button type="button" onClick={onNote} className="fx-reader-popovers-btn-6">
        Note
      </button>
      {canShareToClub ? (
        <button
          type="button"
          aria-pressed={share}
          onClick={() => setShare((s) => !s)}
          className="fx-reader-popovers-btn-7"
        >
          Share to club
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="fx-reader-popovers-btn-6"
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
    <div className="fx-reader-popovers-box" style={{ background: canvas.bg, color: canvas.text }}>
      <div className="mb-2 fx-reader-popovers-row-5">
        {highlightColorValues.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color: ${COLOR_MEANING[c]}`}
            aria-pressed={draft.color === c}
            onClick={() => onChange({ ...draft, color: c })}
            className="fx-reader-swatch"
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
        className="cap-input fx-reader-note"
      />
      <div className="mt-2 row-2 spread">
        {canShareToClub ? (
          <label className="fx-reader-popovers-row-7">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            Share to club
          </label>
        ) : (
          <span />
        )}
        <div className="row-2">
          <button type="button" onClick={onCancel} className="fx-reader-popovers-btn-8">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(share)} className="fx-reader-popovers-btn-9">
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
      className={
        anchored
          ? "fx-reader-pop fx-reader-pop-narrow"
          : "fx-reader-pop fx-reader-pop-narrow fx-reader-pop-docked"
      }
      style={
        anchored
          ? pos
            ? { top: pos.top, left: pos.left, background: canvas.bg, color: canvas.text }
            : { top: 0, left: 0, visibility: "hidden", background: canvas.bg, color: canvas.text }
          : { background: canvas.bg, color: canvas.text }
      }
    >
      <div className="mb-2 fx-reader-popovers-row-5">
        {highlightColorValues.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color: ${COLOR_MEANING[c]}`}
            aria-pressed={annotation.color === c}
            onClick={() => onColor(c)}
            className="fx-reader-popovers-btn-10"
            style={{ background: tintFor(c, "light") }}
          />
        ))}
      </div>
      {annotation.selectedText ? (
        <p className="mb-2 italic fx-reader-popovers-text-3">“{annotation.selectedText}”</p>
      ) : null}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note"
        className="cap-input fx-reader-popovers-btn-2"
      />
      <div className="mt-2 fx-reader-popovers-row-8">
        <button type="button" onClick={onDelete} className="fx-reader-popovers-btn-11">
          Delete
        </button>
        <div className="row-2">
          <button type="button" onClick={onClose} className="fx-reader-popovers-btn-8">
            Close
          </button>
          <button
            type="button"
            onClick={() => onSaveNote(body.trim())}
            className="fx-reader-popovers-btn-9"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
