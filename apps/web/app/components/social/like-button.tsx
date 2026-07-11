// Like control backed by the generic reactions endpoint (PUT/DELETE /reactions). Used
// for reading-list likes and review (diary_entry) likes. No emoji in the UI (Rule 9);
// a heart glyph is inline SVG. Failed writes surface a visible error.
import { useState } from "react";
import { useApiWrite } from "~/hooks/use-api-write";

export function LikeButton({
  targetType,
  targetId,
  initialLiked,
  initialCount,
  signedIn,
}: {
  targetType: "reading_list" | "diary_entry";
  targetId: string;
  initialLiked: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const { write, error, pending } = useApiWrite();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    if (!signedIn) return;
    const next = !liked;
    const res = await write("/reactions", {
      method: next ? "PUT" : "DELETE",
      body: { targetType, targetId, kind: "like" },
    });
    if (res.ok) {
      setLiked(next);
      setCount((n) => Math.max(0, n + (next ? 1 : -1)));
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending || !signedIn}
        aria-pressed={liked}
        aria-label={liked ? "Remove like" : "Like"}
        className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 font-ui text-sm text-secondary transition hover:border-border-interactive disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M12 20.5l-1.4-1.3C6 15.1 3 12.4 3 9.1 3 6.6 5 4.7 7.5 4.7c1.5 0 2.9.7 3.8 1.8l.7.8.7-.8c.9-1.1 2.3-1.8 3.8-1.8C21 4.7 23 6.6 23 9.1c0 3.3-3 6-7.6 10.1L12 20.5z" />
        </svg>
        <span className={liked ? "text-brand-text" : undefined}>{count}</span>
      </button>
      {error ? (
        <p role="alert" className="font-ui text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
