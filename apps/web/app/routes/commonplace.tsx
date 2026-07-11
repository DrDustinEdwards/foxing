// The signed-in reader's commonplace book (auth-gated, noindex): notes and saved
// passages from the reader. Reads run in-process via core; requireProfile gates access.
// Read-only.
import { createDb, annotationsRepo } from "@foxing/core";
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

export default function Commonplace({ loaderData }: Route.ComponentProps) {
  const { entries } = loaderData;

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
          <ul className="flex flex-col gap-3">
            {entries.map((e) => {
              const bookLabel = e.bookTitle ?? e.sourceTitle;
              return (
                <li key={e.id} className="rounded-card border border-border-subtle bg-surface p-5">
                  {e.selectedText ? (
                    <blockquote className="border-l-2 border-border-subtle pl-4 font-body text-base italic text-primary">
                      {e.selectedText}
                    </blockquote>
                  ) : null}
                  {e.body ? (
                    <p className="mt-3 font-ui text-sm text-secondary">{e.body}</p>
                  ) : null}
                  {bookLabel || e.chapter ? (
                    <p className="mt-3 font-ui text-xs text-tertiary">
                      {e.bookSlug ? (
                        <Link to={`/books/${e.bookSlug}`} className="text-brand-text hover:underline">
                          {bookLabel}
                        </Link>
                      ) : bookLabel ? (
                        <span>{bookLabel}</span>
                      ) : null}
                      {bookLabel && e.bookAuthor ? <span> by {e.bookAuthor}</span> : null}
                      {bookLabel && e.chapter ? <span> </span> : null}
                      {e.chapter ? <span>{e.chapter}</span> : null}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
