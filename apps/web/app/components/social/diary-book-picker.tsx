// Book picker for starting a diary entry when /diary/new was opened without a ?book=.
// Searches the catalog as you type and navigates to /diary/new?book=<slug> so
// the loader can resolve the book and render the form.
import { useSuggest } from "@foxing/client";
import { useState } from "react";
import { useNavigate } from "react-router";

export function DiaryBookPicker() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const results = useSuggest(q, 200).books;

  return (
    <div className="card">
      <label className="stack-2">
        <span className="group-label">Find the book to log</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalog"
          className="cap-input py-2"
        />
      </label>
      {results.length > 0 ? (
        <ul aria-label="Matching books" className="mt-2 stack-1">
          {results.map((b) => (
            <li key={b.slug}>
              <button
                type="button"
                onClick={() => navigate(`/diary/new?book=${encodeURIComponent(b.slug)}`)}
                className="fx-pick-option"
              >
                <span className="fx-diary-book-picker-label">{b.title}</span>{" "}
                <span className="dim">{b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
