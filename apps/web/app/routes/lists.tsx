// The signed-in reader's own reading lists index (auth-gated, noindex). Reads run
// in-process via core; requireProfile gates access. Each list links to its detail page;
// a "New list" action links to the create route.
import { createDb, socialRepo } from "@foxing/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, EntityCard, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/lists";

type ListFilter = "all" | "public" | "private";

export function meta() {
  return [{ title: "Your lists | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const [rows, summaries] = await Promise.all([
    socialRepo.listListsForUser(db, user.id),
    socialRepo.listSummariesForUser(db, user.id),
  ]);
  const summ = new Map(summaries.map((s) => [s.listId, s]));
  const lists = rows.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    isPublic: l.isPublic,
    bookCount: summ.get(l.id)?.bookCount ?? 0,
    covers: summ.get(l.id)?.covers ?? [],
  }));
  return { lists };
}

export default function Lists({ loaderData }: Route.ComponentProps) {
  const { lists } = loaderData;
  const [filter, setFilter] = useState<ListFilter>("all");
  const publicCount = lists.filter((l) => l.isPublic).length;
  const shown =
    filter === "all"
      ? lists
      : lists.filter((l) => (filter === "public" ? l.isPublic : !l.isPublic));

  return (
    <PageShell>
      <Container className="max-w-2xl">
        <div className="mb-10 flex items-end justify-between gap-4">
          <PageHeader eyebrow="Reading" title="Your lists" className="mb-0" />
          <Link
            to="/lists/new"
            className="shrink-0 rounded-md bg-brand-ui px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:opacity-90"
          >
            New list
          </Link>
        </div>
        {lists.length === 0 ? (
          <EmptyState
            title="No lists yet."
            body="Group books into a list to share what you are reading or want to read."
          />
        ) : (
          <>
            <nav aria-label="Filter lists" className="mb-6 flex flex-wrap gap-2">
              <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
                All {lists.length}
              </FilterTab>
              <FilterTab active={filter === "public"} onClick={() => setFilter("public")}>
                Public {publicCount}
              </FilterTab>
              <FilterTab active={filter === "private"} onClick={() => setFilter("private")}>
                Private {lists.length - publicCount}
              </FilterTab>
            </nav>
            <ul className="flex flex-col gap-3">
              {shown.map((l) => (
                <li key={l.id}>
                  <EntityCard to={`/lists/${l.id}`}>
                    <div className="flex gap-4">
                      {l.covers.length > 0 ? <CoverStack covers={l.covers} /> : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h2 className="font-display text-lg text-primary">{l.title}</h2>
                          {!l.isPublic ? (
                            <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-tertiary">
                              Private
                            </span>
                          ) : null}
                        </div>
                        {l.description ? (
                          <p className="mt-1 line-clamp-2 font-ui text-sm text-secondary">
                            {l.description}
                          </p>
                        ) : null}
                        <p className="mt-2 font-mono text-xs text-tertiary">
                          {l.bookCount} {l.bookCount === 1 ? "book" : "books"}
                          {" · "}
                          {l.isPublic ? "public" : "private"}
                        </p>
                      </div>
                    </div>
                  </EntityCard>
                </li>
              ))}
            </ul>
          </>
        )}
      </Container>
    </PageShell>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1 font-ui text-sm transition-colors aria-pressed:border-border-interactive aria-pressed:bg-selected aria-pressed:text-primary border-border-subtle text-secondary hover:border-border-interactive hover:text-primary"
    >
      {children}
    </button>
  );
}

// A small overlapping fan of up to four covers as a list preview. Decorative (the list
// title carries the link's meaning), so the images are alt-empty.
function CoverStack({ covers }: { covers: string[] }) {
  return (
    <div className="flex shrink-0 -space-x-3">
      {covers.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="h-16 w-11 rounded-sm border border-border-subtle bg-sunken object-cover shadow-sm"
          style={{ zIndex: covers.length - i }}
        />
      ))}
    </div>
  );
}
