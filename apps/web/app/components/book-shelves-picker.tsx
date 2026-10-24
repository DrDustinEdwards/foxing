// "Add to shelves" toggle for a book, shown to signed-in readers on the book page.
// Membership lives in the book's cached library state; a toggle patches it at once
// and rolls back if the write fails. No shelves yet -> a link to the library, where
// shelves are created.
import { useToggleShelfBook } from "@foxing/client";
import type { Shelf } from "@foxing/types";
import { Link } from "react-router";

export function BookShelvesPicker({
  bookId,
  shelves,
  memberOf,
}: {
  bookId: string;
  shelves: Pick<Shelf, "id" | "name">[];
  memberOf: string[];
}) {
  const toggle = useToggleShelfBook();
  const members = new Set(memberOf);

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
                onClick={() => toggle.fire({ shelfId: shelf.id, bookId, on: !on })}
                aria-pressed={on}
                className="cap-chip"
              >
                {shelf.name}
              </button>
            );
          })}
        </div>
      )}
      {toggle.error ? (
        <p className="mt-2 error xsmall" role="alert">
          {toggle.error}
        </p>
      ) : null}
    </div>
  );
}
