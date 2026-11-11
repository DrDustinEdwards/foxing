// An island (devkit ./islands): the search box (components/search-box.tsx) on a page that does not hydrate (root.tsx).
// The server drew the field and its form, which already searches without a script; Capsomer's search suggestions
// module adds the suggestions, the same one the React box runs.
import { attachSuggest } from "capsomer/behavior/search-suggest";
import { suggestBooks } from "../lib/book-suggest";

export default function start(el: HTMLElement): void {
  const root = el.querySelector<HTMLElement>(".cap-search-suggest");
  if (root) attachSuggest(root, { suggest: suggestBooks });
}
