// Owner-only control to remove a book from a reading list. DELETEs
// /api/v1/lists/:id/books/:bookId and revalidates. Failed writes surface a visible error.
import { useNavigate } from "react-router";
import { useApiWrite } from "~/hooks/use-api-write";

export function RemoveBookButton({ listId, bookId }: { listId: string; bookId: string }) {
  const navigate = useNavigate();
  const { write, error, pending } = useApiWrite();

  async function remove() {
    const res = await write(`/lists/${listId}/books/${bookId}`, { method: "DELETE" });
    if (res.ok) navigate(".", { replace: true, preventScrollReset: true });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="font-ui text-xs text-tertiary transition hover:text-danger-text disabled:opacity-50"
      >
        Remove
      </button>
      {error ? (
        <span role="alert" className="font-ui text-[0.65rem] text-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
