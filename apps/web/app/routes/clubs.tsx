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
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
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
    <Link to={`/clubs/${club.slug}`} className="block fx-clubs-card">
      <p className="display-0">{club.name}</p>
      {club.description ? <p className="mt-1 fx-clubs-text">{club.description}</p> : null}
    </Link>
  );
}

export default function Clubs({ loaderData }: Route.ComponentProps) {
  const { mine, discover } = loaderData;

  return (
    <PageShell>
      <Container>
        <div className="row-4 wrap spread">
          <h1 className="display-4">Book clubs</h1>
          <Link to="/clubs/new" className="cap-btn" data-variant="primary">
            New club
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="fx-clubs-caps">Your clubs</h2>
          {mine.length === 0 ? (
            <div className="mt-4 text-center fx-clubs-card-2">
              <p className="meta">
                You have not joined a club yet. Join one below, or start your own.
              </p>
            </div>
          ) : (
            <div className="mt-4 fx-clubs-grid">
              {mine.map((club) => (
                <ClubRow key={club.id} club={club} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="fx-clubs-caps">Discover</h2>
          {discover.length === 0 ? (
            <p className="mt-4 meta">No public clubs yet.</p>
          ) : (
            <div className="mt-4 fx-clubs-grid">
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
