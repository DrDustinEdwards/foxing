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

  if (!signedIn) {
    return (
      <Link
        to={loginHref}
        className="inline-flex items-center rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
      >
        Sign in to track
      </Link>
    );
  }

  async function apply(next: ShelfStatus | "remove") {
    setPending(true);
    try {
      if (next === "remove") {
        const res = await fetch(`/api/v1/library/${bookId}`, { method: "DELETE" });
        if (res.ok) {
          setStatus("");
          onChanged?.(null);
        }
      } else {
        const res = await fetch(`/api/v1/library/${bookId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (res.ok) {
          setStatus(next);
          onChanged?.(next);
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Reading status</span>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => apply((e.target.value || "remove") as ShelfStatus | "remove")}
        className="rounded-md border border-border-interactive bg-surface px-3 py-2 font-ui text-sm text-primary disabled:opacity-50"
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
  );
}
