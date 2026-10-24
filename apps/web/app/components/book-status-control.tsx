// Shelf-status control for a book. Writes go to /api/v1/library/:bookId (the
// standing write rule); on success it calls onChanged so the caller can revalidate.
// Anonymous readers get a sign-in link instead. Used on /library and the book page.
import { useState } from "react";
import { Link } from "react-router";

const STATUSES = [
  { value: "want", label: "Want to read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Abandoned" },
] as const;

export type ShelfStatus = (typeof STATUSES)[number]["value"];

export function BookStatusControl({
  bookId,
  currentStatus,
  signedIn,
  loginHref,
  onChanged,
}: {
  bookId: string;
  currentStatus: ShelfStatus | null;
  signedIn: boolean;
  loginHref: string;
  onChanged?: (status: ShelfStatus | null) => void;
}) {
  const [status, setStatus] = useState<ShelfStatus | "">(currentStatus ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link to={loginHref} className="cap-btn fx-book-status-control-link">
        Sign in to track
      </Link>
    );
  }

  async function apply(next: ShelfStatus | "remove") {
    setPending(true);
    setError(null);
    try {
      const res =
        next === "remove"
          ? await fetch(`/api/v1/library/${bookId}`, { method: "DELETE" })
          : await fetch(`/api/v1/library/${bookId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: next }),
            });
      if (!res.ok) {
        // Do not swallow: a failed write must be visible, not a silent revert.
        setError("Could not save. Try again.");
        return;
      }
      const applied = next === "remove" ? "" : next;
      setStatus(applied);
      onChanged?.(applied || null);
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fx-book-status-control-box">
      <label className="fx-book-status-control-row">
        <span className="cap-sr-only">Reading status</span>
        <select
          value={status}
          disabled={pending}
          onChange={(e) => apply((e.target.value || "remove") as ShelfStatus | "remove")}
          className="cap-select py-2 fx-book-status-control-box"
        >
          <option value="">Add to library</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          {status ? <option value="remove">Remove from library</option> : null}
        </select>
      </label>
      {pending ? (
        <p className="fx-book-status-control-text" role="status">
          Saving...
        </p>
      ) : null}
      {error ? (
        <p className="fx-book-status-control-text-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
