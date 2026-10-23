// Owner-only control to remove a book from a reading list. DELETEs
// /api/v1/lists/:id/books/:bookId and revalidates. Failed writes surface a visible error.
import { useNavigate } from "react-router";
import { useApiWrite } from "~/hooks/use-api-write";

export function RemoveBookButton({ listId, bookId }: { listId: string; bookId: string }) {
  const navigate = useNavigate();
  const { write, error, pending } = useApiWrite();

  async function remove() {
    const res = await write(`/lists/${listId}/books/${bookId}`, { method: "DELETE" });
    if (res.ok) void navigate(".", { replace: true, preventScrollReset: true });
  }

  return (
    <span className="items-end fx-remove-book-button-label">
      <button
        type="button"
        onClick={remove}
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
