// The signed-in reader's commonplace book (auth-gated, noindex): notes and saved
// passages from the reader. Reads run in-process via core; requireProfile gates access.
// Read-only.
import { createDb, views } from "@foxing/core";
import { useState } from "react";
import {
  AnnotationFilters,
  BookGroups,
  bookKey,
  bookOptions,
} from "~/components/annotations-by-book";
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
  return { entries: await views.myAnnotations(db, user.id, ["commonplace", "note"]) };
}

export default function Commonplace({ loaderData }: Route.ComponentProps) {
  const { entries } = loaderData;
  const [query, setQuery] = useState("");
  const [book, setBook] = useState("all");

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
            <AnnotationFilters
              query={query}
              onQuery={setQuery}
              placeholder="Search notes and passages"
              label="Search commonplace"
              inputClassName="fx-commonplace-input"
              books={bookOptions(entries)}
              book={book}
              onBook={setBook}
              shown={filtered.length}
              total={entries.length}
            />
            <BookGroups
              items={filtered}
              empty="Nothing matches those filters."
              renderItem={(e) => (
                <>
                  {e.selectedText ? (
                    <blockquote className="italic fx-commonplace-quote">
                      {e.selectedText}
                    </blockquote>
                  ) : null}
                  {e.body ? <p className="mt-3 fx-commonplace-text">{e.body}</p> : null}
                  {e.chapter ? <p className="mt-3 fx-commonplace-text-2">{e.chapter}</p> : null}
                </>
              )}
            />
          </>
        )}
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
