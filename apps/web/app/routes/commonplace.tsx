// The signed-in reader's commonplace book (auth-gated, noindex): notes and saved
// passages from the reader. Reads run in-process via core; requireProfile gates access.
// Read-only.
import { createDb, annotationsRepo } from "@foxing/core";
import { useState } from "react";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/commonplace";

export function meta() {
  return [{ title: "Commonplace | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const rows = await annotationsRepo.listForUser(db, user.id, { types: ["commonplace", "note"] });
  const entries = rows.map((a) => ({
    id: a.id,
    selectedText: a.selectedText,
    body: a.body,
    chapter: a.chapter,
    sourceTitle: a.sourceTitle,
    bookTitle: a.bookTitle,
    bookSlug: a.bookSlug,
    bookAuthor: a.bookAuthor,
  }));
  return { entries };
}

type Entry = {
  id: string;
  selectedText: string | null;
  body: string | null;
  chapter: string | null;
  sourceTitle: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
};

function bookKey(e: Entry): string {
  return e.bookSlug ?? e.bookTitle ?? e.sourceTitle ?? "unknown";
}
function bookLabelOf(e: Entry): string {
  return e.bookTitle ?? e.sourceTitle ?? "Unknown book";
}

export default function Commonplace({ loaderData }: Route.ComponentProps) {
  const { entries } = loaderData;
  const [query, setQuery] = useState("");
  const [book, setBook] = useState("all");

  // Distinct books present, in first-seen order, for the book filter.
  const books: Array<{ key: string; label: string }> = [];
  const seenBooks = new Set<string>();
  for (const e of entries) {
    const k = bookKey(e);
    if (!seenBooks.has(k)) {
      seenBooks.add(k);
      books.push({ key: k, label: bookLabelOf(e) });
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (book !== "all" && bookKey(e) !== book) return false;
    if (q) {
      const hay =
        `${e.selectedText ?? ""} ${e.body ?? ""} ${e.bookTitle ?? ""} ${e.sourceTitle ?? ""} ${e.bookAuthor ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Group the filtered entries under their book.
  const groups: Array<{
    key: string;
    label: string;
    author: string | null;
    slug: string | null;
    items: Entry[];
  }> = [];
  const groupIndex = new Map<string, number>();
  for (const e of filtered) {
    const k = bookKey(e);
    let i = groupIndex.get(k);
    if (i === undefined) {
      i = groups.length;
      groupIndex.set(k, i);
      groups.push({
        key: k,
        label: bookLabelOf(e),
        author: e.bookAuthor,
        slug: e.bookSlug,
        items: [],
      });
    }
    groups[i].items.push(e);
  }

  return (
    <PageShell>
      <Container className="max-w-2xl">
        <PageHeader
          eyebrow="Reading"
          title="Commonplace"
          lede="Notes and passages you save while reading gather here."
        />
        {entries.length === 0 ? (
          <EmptyState
            title="Nothing saved yet."
            body="Notes and saved passages from the reader will appear here."
          />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search notes and passages"
                  aria-label="Search commonplace"
                  className="min-w-[12rem] flex-1 rounded-md border border-border-subtle bg-base px-3 py-1.5 text-sm"
                />
                {books.length > 1 ? (
                  <label className="font-ui text-sm text-secondary">
                    <span className="sr-only">Filter by book</span>
                    <select
                      value={book}
                      onChange={(e) => setBook(e.target.value)}
                      className="rounded-md border border-border-subtle bg-base px-2 py-1.5 text-sm"
                    >
                      <option value="all">All books</option>
                      {books.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <span className="font-ui text-xs text-tertiary">
                {filtered.length} of {entries.length}
              </span>
            </div>

            {groups.length === 0 ? (
              <p className="font-ui text-sm text-tertiary">Nothing matches those filters.</p>
            ) : (
              <div className="flex flex-col gap-8">
                {groups.map((g) => (
                  <section key={g.key} className="flex flex-col gap-3">
                    <h2 className="font-display text-lg text-primary">
                      {g.slug ? (
                        <Link to={`/books/${g.slug}`} className="hover:text-brand-text">
                          {g.label}
                        </Link>
                      ) : (
                        g.label
                      )}
                      {g.author ? <span className="text-tertiary"> by {g.author}</span> : null}
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {g.items.map((e) => (
                        <li
                          key={e.id}
                          className="rounded-card border border-border-subtle bg-surface p-5"
                        >
                          {e.selectedText ? (
                            <blockquote className="border-l-2 border-border-subtle pl-4 font-body text-base italic text-primary">
                              {e.selectedText}
                            </blockquote>
                          ) : null}
                          {e.body ? (
                            <p className="mt-3 font-ui text-sm text-secondary">{e.body}</p>
                          ) : null}
                          {e.chapter ? (
                            <p className="mt-3 font-ui text-xs text-tertiary">{e.chapter}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </PageShell>
  );
}
