import { useToggleShelfBook } from "@foxing/client";
import type { Shelf } from "@foxing/types";
import { Link } from "capsomer/react/link";
import { FormError } from "~/components/ui";

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
    <div className="cap-card cap-stack" data-gap="5">
      <div className="cap-stack" data-gap="3">
        <p
          className="cap-text"
          data-size="small"
          data-tone="ink"
          data-weight="strong"
          data-face="ui"
        >
          Add to shelves
        </p>
        {shelves.length === 0 ? (
          <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
            You have no shelves yet.{" "}
            <Link to="/library" className="link">
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="fx-book-shelves-picker-row">
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
      </div>
      <FormError error={toggle.error} />
    </div>
  );
}
