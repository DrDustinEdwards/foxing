// People at /people: the follow graph (who you follow, who follows you) and the
// close-friends management surface. Following/followers and curating close friends
// (the audience for your friends-only content) are all free. The loader seeds the shared
// cache; a toggle patches every list here in place.
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

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  return views.people(createDb(env.DB), user.id);
}

export function meta() {
  return [{ title: "People | Foxing" }, { name: "robots", content: "noindex" }];
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
        <span className="min-0">
          <span className="block truncate fx-people-label">{name}</span>
          <span className="block truncate fx-people-label-2">@{p.username}</span>
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
      <Container className="stack-10">
        <PageHeader
          eyebrow="Your Foxing"
          title="People"
          lede="The readers you follow and who follow you."
        />

        <section className="stack">
          <h2 className="display-2">Following</h2>
          {following.length === 0 ? (
            <EmptyState
              title="Not following anyone yet"
              body="Open a reader's profile to follow them."
            />
          ) : (
            <ul className="stack-2">
              {following.map((p) => (
                <Row key={p.id} p={p}>
                  <CloseFriendToggle userId={p.id} isClose={p.isClose} />
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="stack">
          <h2 className="display-2">Followers</h2>
          {followers.length === 0 ? (
            <p className="meta">No followers yet.</p>
          ) : (
            <ul className="stack-2">
              {followers.map((p) => (
                <Row key={p.id} p={p}>
                  <FollowButton userId={p.id} following={p.isFollowing} signedIn />
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="stack">
          <h2 className="display-2">Close friends</h2>
          <p className="ui">
            Close friends see your friends-only reviews, activity, and shared annotations.
          </p>
          {closeFriends.length === 0 ? (
            <p className="meta">No close friends yet. Add someone from your Following list.</p>
          ) : (
            <ul className="stack-2">
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
