import { SearchSuggest } from "capsomer/react/search-suggest";
import { useNavigate } from "react-router";
import { suggestBooks } from "~/lib/book-suggest";

/**
 * The site's search box: Capsomer's search suggestions over the catalog. Submitting runs the full
 * /search (which includes the fuzzy fallback); a suggestion opens its book. It is a plain GET form
 * without JS. On a page that does not hydrate (root.tsx) the search-box island
 * (islands/search-box.ts) wires the same markup with the same module.
 */
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
