// Like control backed by the generic reactions endpoint (PUT/DELETE /reactions). Used
// for reading-list likes; the cached list page holds the count. No emoji in the UI (Rule 9);
// a heart glyph is inline SVG. Failed writes surface a visible error.
import { useReaction } from "@foxing/client";

export function LikeButton({
  targetType,
  targetId,
  liked,
  count,
  signedIn,
}: {
  targetType: "reading_list";
  targetId: string;
  liked: boolean;
  count: number;
  signedIn: boolean;
}) {
  const { fire, error, pending } = useReaction();

  return (
    <div className="items-start fx-like-button-box">
      <button
        type="button"
        onClick={() => signedIn && fire({ targetType, targetId, on: !liked })}
        disabled={pending || !signedIn}
        aria-pressed={liked}
        aria-label={liked ? "Remove like" : "Like"}
        className="cap-chip"
      >
        <svg
          viewBox="0 0 24 24"
          className="fx-like-button-icon"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M12 20.5l-1.4-1.3C6 15.1 3 12.4 3 9.1 3 6.6 5 4.7 7.5 4.7c1.5 0 2.9.7 3.8 1.8l.7.8.7-.8c.9-1.1 2.3-1.8 3.8-1.8C21 4.7 23 6.6 23 9.1c0 3.3-3 6-7.6 10.1L12 20.5z" />
        </svg>
        <span className={liked ? "accent" : undefined}>{count}</span>
      </button>
      {error ? (
        <p role="alert" className="fx-like-button-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
