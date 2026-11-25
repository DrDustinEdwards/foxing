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
