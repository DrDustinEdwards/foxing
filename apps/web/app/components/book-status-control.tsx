// Shelf-status control for a book. The write goes through @foxing/client's
// useSetBookStatus, which patches the library and this book's cached state at once
// and rolls back on failure, so the page never reloads. Anonymous readers get a
// sign-in link instead. Used on /library, the book page and find-next-book.
import { useSetBookStatus } from "@foxing/client";
import type { BookRef, ShelfStatus } from "@foxing/types";
import { useEffect, useState } from "react";
import { Link } from "capsomer/react/link";

const STATUSES = [
  { value: "want", label: "Want to read" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Abandoned" },
] as const;

export type { ShelfStatus };

export function BookStatusControl({
  book,
  currentStatus,
  signedIn,
  loginHref,
}: {
  book: BookRef;
  currentStatus: ShelfStatus | null;
  signedIn: boolean;
  loginHref: string;
}) {
  const setStatus = useSetBookStatus();
  // Follows the cache when the page has one; otherwise remembers the last pick.
  const [status, setLocal] = useState<ShelfStatus | null>(currentStatus);
  useEffect(() => setLocal(currentStatus), [currentStatus]);

  if (!signedIn) {
    return (
      <Link to={loginHref} className="cap-btn fx-book-status-control-link">
        Sign in to track
      </Link>
    );
  }

  async function apply(next: ShelfStatus | null) {
    const before = status;
    setLocal(next);
    const ok = await setStatus.run({ bookId: book.id, status: next, book });
    if (!ok) setLocal(before);
  }

  return (
    <div className="fx-book-status-control-box">
      <label className="fx-book-status-control-row">
        <span className="cap-sr-only">Reading status</span>
        <select
          value={status ?? ""}
          disabled={setStatus.pending}
          onChange={(e) =>
            apply(
              e.target.value === "" || e.target.value === "remove"
                ? null
                : (e.target.value as ShelfStatus),
            )
          }
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
      {setStatus.pending ? (
        <p className="fx-book-status-control-text" role="status">
          Saving...
        </p>
      ) : null}
      {setStatus.error ? (
        <p className="fx-book-status-control-text-2" role="alert">
          {setStatus.error}
        </p>
      ) : null}
    </div>
  );
}
