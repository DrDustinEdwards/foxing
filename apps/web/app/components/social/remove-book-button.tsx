// Owner-only control to remove a book from a reading list. DELETEs
// /api/v1/lists/:id/books/:bookId; the book leaves the cached list at once. Failed writes surface a visible error.
import { useRemoveListBook } from "@foxing/client";

export function RemoveBookButton({ listId, bookId }: { listId: string; bookId: string }) {
  const { fire, error, pending } = useRemoveListBook();

  return (
    <span className="items-end fx-remove-book-button-label">
      <button
        type="button"
        onClick={() => fire({ listId, bookId })}
        disabled={pending}
        className="fx-remove-book-button-btn"
      >
        Remove
      </button>
      {error ? (
        <span role="alert" className="fx-remove-book-button-label-2">
          {error}
        </span>
      ) : null}
    </span>
  );
}
