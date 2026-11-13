// Club list (auth-gated). The loader reads the clubs view in-process and seeds the
// shared cache, so joining or leaving a club updates this list without a reload. The
// "New club" button routes to /clubs/new; joining happens on the club detail page.
import { useClubsIndex } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/clubs";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return views.clubsIndex(createDb(env.DB), user.id);
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
    <Link to={`/clubs/${club.slug}`}>
      <div className="cap-card">
        <h3 className="display-0">{club.name}</h3>
        {club.description ? <p className="fx-clubs-text">{club.description}</p> : null}
      </div>
    </Link>
  );
}

export default function Clubs({ loaderData }: Route.ComponentProps) {
  const { mine, discover } = useClubsIndex(loaderData).data;

  return (
    <PageShell>
      <Container>
        <div className="cap-spread" data-gap="5" data-align="center">
          <h1 className="display-4">Book clubs</h1>
          <Link to="/clubs/new" className="cap-btn" data-variant="primary">
            New club
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="fx-clubs-caps">Your clubs</h2>
          {mine.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="You have not joined a club yet."
              body="Join one below, or start your own."
            />
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
            <p className="mt-4 cap-meta sans">No public clubs yet.</p>
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

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
