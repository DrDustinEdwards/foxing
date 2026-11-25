import { qs, useApi } from "@foxing/client";
import type { SearchSuggest } from "@foxing/types";
import { Combobox, type ComboboxOption } from "capsomer/react/combobox";
import { useRef } from "react";

export type SuggestedBook = SearchSuggest["books"][number];

export function BookCombobox({
  label,
  help,
  placeholder = "Search the catalog by title or author",
  error,
  disabled,
  onPick,
}: {
  label: string;
  help?: React.ReactNode;
  placeholder?: string;
  error?: React.ReactNode;
  disabled?: boolean;
  onPick: (book: SuggestedBook) => void;
}) {
  const api = useApi();
  const found = useRef(new Map<string, SuggestedBook>());

  async function search(q: string, signal: AbortSignal): Promise<ComboboxOption[]> {
    const { books } = await api.get<SearchSuggest>(`/search/suggest${qs({ q })}`, signal);
    found.current = new Map(books.map((b) => [b.id, b]));
    return books.map((b) => ({ value: b.id, label: b.title, hint: b.author }));
  }

  return (
    <Combobox
      label={label}
      help={help}
      placeholder={placeholder}
      error={error}
      disabled={disabled}
      items={[]}
      search={search}
      minSearchLength={2}
      value={null}
      onValueChange={(id) => {
        const book = id ? found.current.get(id) : undefined;
        if (book) onPick(book);
      }}
    />
  );
}
