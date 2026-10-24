// "Add to shelves" toggle for a book, shown to signed-in readers on the book page.
// Writes go to /api/v1/shelves/:id/books (the standing write rule); toggles are
// optimistic and revert on failure. No shelves yet -> a link to the library, where
// shelves are created.
import { useState } from "react";
import { Link } from "react-router";

interface ShelfOption {
  id: string;
  name: string;
}

export function BookShelvesPicker({
  bookId,
  shelves,
  memberOf,
}: {
  bookId: string;
  shelves: ShelfOption[];
  memberOf: string[];
}) {
  const [members, setMembers] = useState<Set<string>>(new Set(memberOf));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(shelfId: string) {
    const on = members.has(shelfId);
    setPending(shelfId);
    setError(null);
    // Optimistic.
    setMembers((prev) => {
      const next = new Set(prev);
      if (on) next.delete(shelfId);
      else next.add(shelfId);
      return next;
    });
    try {
      const res = on
        ? await fetch(`/api/v1/shelves/${shelfId}/books/${bookId}`, { method: "DELETE" })
        : await fetch(`/api/v1/shelves/${shelfId}/books`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookId }),
          });
      if (!res.ok) throw new Error("toggle failed");
    } catch {
      // Revert and surface the failure instead of silently snapping back.
      setMembers((prev) => {
        const next = new Set(prev);
        if (on) next.add(shelfId);
        else next.delete(shelfId);
        return next;
      });
      setError("Could not update shelves. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="card">
      <p className="sans small strong">Add to shelves</p>
      {shelves.length === 0 ? (
        <p className="mt-2 meta">
          You have no shelves yet.{" "}
          <Link to="/library" className="link">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-3 fx-book-shelves-picker-row">
          {shelves.map((shelf) => {
            const on = members.has(shelf.id);
            return (
              <button
                key={shelf.id}
                type="button"
                onClick={() => toggle(shelf.id)}
                disabled={pending === shelf.id}
                aria-pressed={on}
                className="cap-chip"
              >
                {shelf.name}
              </button>
            );
          })}
        </div>
      )}
      {error ? (
        <p className="mt-2 error xsmall" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
