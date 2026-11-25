import { attachSuggest } from "capsomer/behavior/search-suggest";
import { suggestBooks } from "../lib/book-suggest";

export default function start(el: HTMLElement): void {
  const root = el.querySelector<HTMLElement>(".cap-search-suggest");
  if (root) attachSuggest(root, { suggest: suggestBooks });
}
