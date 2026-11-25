import { useClubsIndex } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { ButtonLink, Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/clubs";
import { noindexPageMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return views.clubsIndex(createDb(env.DB), user.id);
}

export function meta() {
  return noindexPageMeta("Book clubs | Foxing");
}

function ClubRow({
  club,
}: {
  club: { slug: string | null; name: string; description: string | null };
}) {
  return (
    <Link to={`/clubs/${club.slug}`}>
      <div className="cap-card">
        <h3 className="cap-title" data-size="5">
          {club.name}
        </h3>
        {club.description ? <p className="fx-clubs-text">{club.description}</p> : null}
      </div>
    </Link>
  );
}

export default function Clubs({ loaderData }: Route.ComponentProps) {
  const { mine, discover } = useClubsIndex(loaderData).data;

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="8">
        <div className="cap-spread" data-gap="5" data-align="center">
          <h1 className="cap-title" data-size="1">
            Book clubs
          </h1>
          <ButtonLink to="/clubs/new" variant="primary">
            New club
          </ButtonLink>
        </div>

        <section className="cap-stack" data-gap="5">
          <h2 className="fx-clubs-caps">Your clubs</h2>
          {mine.length === 0 ? (
            <EmptyState title="You have not joined a club yet." />
          ) : (
            <div className="fx-clubs-grid">
              {mine.map((club) => (
                <ClubRow key={club.id} club={club} />
              ))}
            </div>
          )}
        </section>

        <section className="cap-stack" data-gap="5">
          <h2 className="fx-clubs-caps">Discover</h2>
          {discover.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No public clubs yet.
            </p>
          ) : (
            <div className="fx-clubs-grid">
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

export const handle = { hydrate: true };
