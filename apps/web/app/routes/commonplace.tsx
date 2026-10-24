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
      <Container>
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
            <div className="mb-6 stack-3">
              <div className="row wrap">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search notes and passages"
                  aria-label="Search commonplace"
                  className="cap-input fx-commonplace-input"
                />
                {books.length > 1 ? (
                  <label className="ui">
                    <span className="cap-sr-only">Filter by book</span>
                    <select
                      value={book}
                      onChange={(e) => setBook(e.target.value)}
                      className="cap-select"
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
              <span className="fine">
                {filtered.length} of {entries.length}
              </span>
            </div>

            {groups.length === 0 ? (
              <p className="meta">Nothing matches those filters.</p>
            ) : (
              <div className="stack-8">
                {groups.map((g) => (
                  <section key={g.key} className="stack-3">
                    <h2 className="display-0">
                      {g.slug ? (
                        <Link to={`/books/${g.slug}`} className="hover-accent">
                          {g.label}
                        </Link>
                      ) : (
                        g.label
                      )}
                      {g.author ? <span className="dim"> by {g.author}</span> : null}
                    </h2>
                    <ul className="stack-3">
                      {g.items.map((e) => (
                        <li key={e.id} className="card card-5">
                          {e.selectedText ? (
                            <blockquote className="italic fx-commonplace-quote">
                              {e.selectedText}
                            </blockquote>
                          ) : null}
                          {e.body ? <p className="mt-3 fx-commonplace-text">{e.body}</p> : null}
                          {e.chapter ? (
                            <p className="mt-3 fx-commonplace-text-2">{e.chapter}</p>
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
