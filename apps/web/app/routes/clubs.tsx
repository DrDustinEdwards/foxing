// Club list (auth-gated). Reads run in-process via core; the "New club" button routes
// to /clubs/new, which is Plus-gated (free users see the paywall there). Joining a club
// is free and happens on the club detail page.
import { Link, redirect } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { loadClubsIndex } from "~/lib/clubs.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/clubs";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login?redirect=/clubs");
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const { mine, discover } = await loadClubsIndex(env, session.user.id);
  return { mine, discover };
}

export function meta() {
  return [{ title: "Book clubs | Foxing" }, { name: "robots", content: "noindex" }];
}

function ClubRow({
  club,
}: {
  club: { slug: string | null; name: string; description: string | null };
}) {
  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block rounded-card border border-border-subtle bg-surface p-5 transition-colors hover:border-border-interactive"
    >
      <p className="font-display text-lg text-primary">{club.name}</p>
      {club.description ? (
        <p className="mt-1 line-clamp-2 font-body text-sm text-secondary">{club.description}</p>
      ) : null}
    </Link>
  );
}

export default function Clubs({ loaderData }: Route.ComponentProps) {
  const { mine, discover } = loaderData;

  return (
    <PageShell>
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-4xl">Book clubs</h1>
          <Link
            to="/clubs/new"
            className="rounded-cover bg-brand-text px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover dark:text-[color:var(--section-charcoal)]"
          >
            New club
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-tertiary">
            Your clubs
          </h2>
          {mine.length === 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-border-subtle bg-surface p-8 text-center">
              <p className="font-ui text-sm text-tertiary">
                You have not joined a club yet. Join one below, or start your own.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {mine.map((club) => (
                <ClubRow key={club.id} club={club} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-tertiary">Discover</h2>
          {discover.length === 0 ? (
            <p className="mt-4 font-ui text-sm text-tertiary">No public clubs yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {discover.map((club) => (
                <ClubRow key={club.id} club={club} />
              ))}
            </div>
          )}
        </section>
      </Container>
    </PageShell>
  );
}
