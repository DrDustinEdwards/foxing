// Book picker for admin forms (BOTM, celebrity picks): the chosen book with a Change button, or
// BookCombobox to choose one from the public /api/v1/search/suggest. Emits the selected book (or
// null when cleared).
import { BookCombobox, type SuggestedBook } from "../book-combobox";

export function BookPicker({
  label,
  selected,
  onPick,
}: {
  label: string;
  selected: { id: string; title: string; author: string } | null;
  onPick: (book: SuggestedBook | null) => void;
}) {
  if (selected) {
    return (
      <div>
        <span className="fx-label">{label}</span>
        <div className="py-2 fx-book-picker-card">
          <span className="fx-book-picker-label">
            <span className="fx-book-picker-label-2">{selected.title}</span>
            <span className="cap-text" data-tone="dim">
              {" "}
              by {selected.author}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="shrink-0 fx-book-picker-btn"
          >
            Change
          </button>
        </div>
      </div>
    );
  }
  return <BookCombobox label={label} onPick={onPick} />;
}
