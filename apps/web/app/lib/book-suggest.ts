// The books the search box suggests (Capsomer's search suggestions), from the public
// /api/v1/search/suggest: each a page to go to, its title with the author beside it. The React
// search box and its island on a page that does not hydrate both ask through this.
import type { SearchSuggest } from "@foxing/types";
import type { Suggestion } from "capsomer/behavior/search-suggest";

/** The public suggest endpoint's answer for what was typed; a refusal throws. */
export async function fetchSuggest(q: string, signal: AbortSignal): Promise<SearchSuggest> {
  const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`suggest ${res.status}`);
  return (await res.json()) as SearchSuggest;
}

export async function suggestBooks(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const { books } = await fetchSuggest(q, signal);
  return books.map((b) => ({ label: b.title, hint: b.author, href: `/books/${b.slug}` }));
}
