import { usePeople } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { CloseFriendToggle } from "~/components/social/close-friend-toggle";
import { FollowButton } from "~/components/social/follow-button";
import { Avatar, Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/people";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return views.people(createDb(env.DB), user.id);
}

export function meta() {
  return noindexMeta("People | Foxing");
}

function Row({
  p,
  children,
}: {
  p: { username: string; displayName: string | null; avatarUrl: string | null };
  children?: React.ReactNode;
}) {
  const name = p.displayName ?? p.username;
  return (
    <li className="py-3 fx-people-card">
      <Link to={`/u/${p.username}`} className="fx-people-link">
        <Avatar src={p.avatarUrl} name={name} size="sm" />
        <span className="cap-shrink">
          <span className="cap-clamp block fx-people-label" data-lines="1">
            {name}
          </span>
          <span className="cap-clamp block fx-people-label-2" data-lines="1">
            @{p.username}
          </span>
        </span>
      </Link>
      {children}
    </li>
  );
}

export default function People({ loaderData }: Route.ComponentProps) {
  const { following, followers, closeFriends } = usePeople(loaderData).data;

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="8">
        <PageHeader title="People" />

        <section className="cap-stack">
          <h2 className="cap-title" data-size="3">
            Following
          </h2>
          {following.length === 0 ? (
            <EmptyState title="Not following anyone yet" />
          ) : (
            <ul className="cap-stack" data-gap="3">
              {following.map((p) => (
                <Row key={p.id} p={p}>
                  <CloseFriendToggle userId={p.id} isClose={p.isClose} />
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="cap-stack">
          <h2 className="cap-title" data-size="3">
            Followers
          </h2>
          {followers.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No followers yet.
            </p>
          ) : (
            <ul className="cap-stack" data-gap="3">
              {followers.map((p) => (
                <Row key={p.id} p={p}>
                  <FollowButton userId={p.id} following={p.isFollowing} signedIn />
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="cap-stack">
          <h2 className="cap-title" data-size="3">
            Close friends
          </h2>
          {closeFriends.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No close friends yet.
            </p>
          ) : (
            <ul className="cap-stack" data-gap="3">
              {closeFriends.map((p) => (
                <Row key={p.id} p={p}>
                  <CloseFriendToggle userId={p.id} isClose />
                </Row>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };
