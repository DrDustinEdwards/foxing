// An island (devkit ./islands): the search-as-you-type field (components/search-box.tsx) on a page that does not
// hydrate (root.tsx). The server drew the field and its form, which already searches without a script; this adds the
// suggestions the React SearchBox shows, as it shows them: asked 180 ms after the last key once two letters are
// typed, the field a WAI-ARIA combobox whose focus stays put while the arrows move through a listbox of books.

type SuggestedBook = { slug: string; title: string; author: string };

const SUGGEST_DELAY_MS = 180;

export default function start(el: HTMLElement): void {
  const input = el.querySelector<HTMLInputElement>("input[role='combobox']");
  if (!input) return;
  const listId = input.getAttribute("aria-controls") ?? "fx-suggest";
  let items: SuggestedBook[] = [];
  let active = -1;
  let list: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | null = null;

  const go = (slug: string) => location.assign(`/books/${slug}`);

  function close() {
    list?.remove();
    list = null;
    input?.setAttribute("aria-expanded", "false");
  }

  function setActive(next: number) {
    active = next;
    if (!input) return;
    if (active >= 0) input.setAttribute("aria-activedescendant", `${listId}-${active}`);
    else input.removeAttribute("aria-activedescendant");
    list?.querySelectorAll<HTMLElement>("[role='option']").forEach((option, i) => {
      option.setAttribute("aria-selected", String(i === active));
      if (i === active) option.dataset.active = "";
      else delete option.dataset.active;
    });
  }

  function open() {
    if (!input || items.length === 0) return;
    list?.remove();
    list = document.createElement("div");
    list.id = listId;
    list.setAttribute("role", "listbox");
    list.className = "cap-listbox fx-suggest";
    items.forEach((book, i) => {
      const option = document.createElement("div");
      option.id = `${listId}-${i}`;
      option.setAttribute("role", "option");
      option.tabIndex = -1;
      option.className = "cap-option";
      const label = document.createElement("span");
      label.className = "cap-option-label";
      const title = document.createElement("span");
      title.className = "display-s";
      title.textContent = book.title;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = ` · ${book.author}`;
      label.appendChild(title);
      label.appendChild(meta);
      option.appendChild(label);
      option.addEventListener("mouseenter", () => setActive(i));
      option.addEventListener("mousedown", (e) => {
        e.preventDefault();
        close();
        go(book.slug);
      });
      list?.appendChild(option);
    });
    el.appendChild(list);
    input.setAttribute("aria-expanded", "true");
    setActive(active);
  }

  input.addEventListener("input", () => {
    setActive(-1);
    clearTimeout(timer);
    pending?.abort();
    const q = input.value.trim();
    if (q.length < 2) {
      items = [];
      close();
      return;
    }
    const ctrl = new AbortController();
    pending = ctrl;
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { books?: SuggestedBook[] };
        if (ctrl.signal.aborted) return;
        items = data.books ?? [];
        // A new set of suggestions opens the list; none closes it.
        if (items.length > 0) open();
        else close();
      } catch {
        // Aborted or offline: the form still searches.
      }
    }, SUGGEST_DELAY_MS);
  });

  input.addEventListener("keydown", (e) => {
    if (!list) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(active + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(active - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const book = items[active];
      close();
      go(book.slug);
    } else if (e.key === "Escape") {
      close();
    }
  });
  input.addEventListener("focus", () => {
    if (items.length > 0) open();
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.form?.addEventListener("submit", close);
}
