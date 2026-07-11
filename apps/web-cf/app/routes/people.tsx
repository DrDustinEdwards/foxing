// People at /people: the follow graph (who you follow, who follows you) and the Plus
// close-friends management surface. Following/followers are free; curating close friends
// (the audience for your friends-only content) is Plus. Reads run in-process; toggles
// write to /api/v1.
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { CloseFriendToggle } from "~/components/social/close-friend-toggle";
import { FollowButton } from "~/components/social/follow-button";
import { Avatar, Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import { loadPeople } from "~/lib/social.server";
import type { Route } from "./+types/people";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const people = await loadPeople(env, user.id);
  return {
    isPlus: profile.subscriptionTier === "plus",
    following: people.following.map((p) => ({ ...p, isClose: people.closeFriendIds.has(p.id) })),
    followers: people.followers,
    closeFriends: people.closeFriends,
  };
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
    <li className="flex items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3">
      <Link to={`/u/${p.username}`} className="flex min-w-0 items-center gap-3">
        <Avatar src={p.avatarUrl} name={name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-ui text-sm font-medium text-primary">{name}</span>
          <span className="block truncate font-mono text-xs text-tertiary">@{p.username}</span>
        </span>
      </Link>
      {children}
    </li>
  );
}

export default function People({ loaderData }: Route.ComponentProps) {
  const { isPlus, following, followers, closeFriends } = loaderData;

  return (
    <PageShell>
      <Container className="max-w-2xl flex flex-col gap-10">
        <PageHeader
          eyebrow="Your Foxing"
          title="People"
          lede="The readers you follow and who follow you."
        />

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl">Following</h2>
          {following.length === 0 ? (
            <EmptyState
              title="Not following anyone yet"
              body="Open a reader's profile to follow them."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {following.map((p) => (
                <Row key={p.id} p={p}>
                  <CloseFriendToggle userId={p.id} initialClose={p.isClose} isPlus={isPlus} />
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl">Followers</h2>
          {followers.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No followers yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {followers.map((p) => (
                <Row key={p.id} p={p}>
                  <FollowButton userId={p.id} initialFollowing={p.isFollowing} signedIn />
                </Row>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl">Close friends</h2>
          <p className="font-ui text-sm text-secondary">
            Close friends see your friends-only reviews and activity. Curating this list is part of
            Foxing Plus.
          </p>
          {closeFriends.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">
              No close friends yet. Add someone from your Following list.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {closeFriends.map((p) => (
                <Row key={p.id} p={p}>
                  <CloseFriendToggle userId={p.id} initialClose isPlus={isPlus} />
                </Row>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </PageShell>
  );
}
