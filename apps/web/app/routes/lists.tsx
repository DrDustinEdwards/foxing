// The signed-in reader's own reading lists index (auth-gated, noindex). Reads run
// in-process via core; requireProfile gates access. Each list links to its detail page;
// a "New list" action links to the create route.
import { createDb, socialRepo } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, EntityCard, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/lists";

export function meta() {
  return [{ title: "Your lists | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const rows = await socialRepo.listListsForUser(db, user.id);
  const lists = rows.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    isPublic: l.isPublic,
  }));
  return { lists };
}

export default function Lists({ loaderData }: Route.ComponentProps) {
  const { lists } = loaderData;

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
          <ul className="flex flex-col gap-3">
            {lists.map((l) => (
              <li key={l.id}>
                <EntityCard to={`/lists/${l.id}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-lg text-primary">{l.title}</h2>
                    {!l.isPublic ? (
                      <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-tertiary">
                        Private
                      </span>
                    ) : null}
                  </div>
                  {l.description ? (
                    <p className="mt-1 font-ui text-sm text-secondary">{l.description}</p>
                  ) : null}
                </EntityCard>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
