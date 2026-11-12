// Book picker for starting a diary entry when /diary/new was opened without a ?book=.
// Searches the catalog as you type (BookCombobox) and navigates to /diary/new?book=<slug> so
// the loader can resolve the book and render the form.
import { useNavigate } from "react-router";
import { BookCombobox } from "../book-combobox";

export function DiaryBookPicker() {
  const navigate = useNavigate();
  return (
    <div className="cap-card">
      <BookCombobox
        label="Find the book to log"
        placeholder="Search the catalog"
        onPick={(b) => void navigate(`/diary/new?book=${encodeURIComponent(b.slug)}`)}
      />
    </div>
  );
}
