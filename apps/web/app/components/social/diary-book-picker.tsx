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
