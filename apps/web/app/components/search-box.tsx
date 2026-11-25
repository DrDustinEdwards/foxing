import { SearchSuggest } from "capsomer/react/search-suggest";
import { useNavigate } from "react-router";
import { suggestBooks } from "~/lib/book-suggest";

/** The site's search box: a plain GET form without JS; the search-box island wires the same markup on a page that does not hydrate. */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  return (
    <div data-island="search-box">
      <SearchSuggest
        rootClassName="fx-search-field"
        label="Search books and authors"
        labelHidden
        action="/search"
        name="q"
        placeholder="Search titles and authors"
        defaultValue={initialQuery}
        suggest={suggestBooks}
        go={(href) => void navigate(href)}
        search={(q) => void navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search")}
      />
    </div>
  );
}
