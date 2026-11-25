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
import { noindexPageMeta } from "~/lib/seo";

export function meta() {
  return noindexPageMeta("Commonplace | Foxing");
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
        <PageHeader title="Commonplace" />
        {entries.length === 0 ? (
          <EmptyState title="Nothing saved yet." />
        ) : (
          <div className="cap-stack" data-gap="6">
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
                  {e.body ? <p className="fx-commonplace-text">{e.body}</p> : null}
                  {e.chapter ? <p className="fx-commonplace-text-2">{e.chapter}</p> : null}
                </>
              )}
            />
          </div>
        )}
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };
