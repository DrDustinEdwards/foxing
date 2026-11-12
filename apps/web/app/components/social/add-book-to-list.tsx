// Owner-only control to add a book to a reading list. Searches the catalog as you type
// (BookCombobox), then PUTs /api/v1/lists/:id/books with the chosen book id; the list refetches.
// A failed write shows as the field's error.
import { useAddListBook } from "@foxing/client";
import { BookCombobox } from "../book-combobox";

export function AddBookToList({ listId }: { listId: string }) {
  const { run, error, pending } = useAddListBook();
  return (
    <div className="cap-card">
      <BookCombobox
        label="Add a book"
        placeholder="Search the catalog"
        disabled={pending}
        error={error}
        onPick={(b) => void run({ listId, bookId: b.id })}
      />
    </div>
  );
}
