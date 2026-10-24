// The activity feed at /feed. Aggregates events from people you follow (public) and
// people whose close-friends list includes you (friends-only), plus your own new-follower
// notices. Visibility resolves entirely server-side in core; the loader receives only
// what the viewer is entitled to see.
import { activityText, useFeed } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Avatar, Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/feed";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const page = await views.feed(createDb(env.DB), user.id, cursor ? Number(cursor) : null);
  return { page, cursor: cursor ? Number(cursor) : null };
}

export function meta() {
  return [{ title: "Your feed | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Feed({ loaderData }: Route.ComponentProps) {
  const { rows, nextCursor } = useFeed(loaderData.cursor, loaderData.page).data;

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Your Foxing"
          title="Feed"
          lede="What the people you follow are reading."
        />

        {rows.length === 0 ? (
          <EmptyState
            title="Your feed is quiet"
            body="Follow other readers to see their reviews, finishes, and lists here."
          />
        ) : (
          <ul className="stack-3">
            {rows.map((row) =>
              row.kind === "follower" ? (
                <li key={`f-${row.id}`} className="py-3 fx-feed-card">
                  {row.actorLabel}
                </li>
              ) : (
                <li key={`a-${row.id}`} className="items-start fx-feed-card-2">
                  <Avatar
                    src={row.actor?.avatarUrl ?? null}
                    name={row.actor?.displayName ?? row.actor?.username ?? "Reader"}
                    size="sm"
                  />
                  <div className="fx-feed-box">
                    <p className="muted">
                      {row.actor ? (
                        <Link to={`/u/${row.actor.username}`} className="fx-feed-link">
                          {row.actor.displayName ?? row.actor.username}
                        </Link>
                      ) : (
                        <span className="strong">Someone</span>
                      )}{" "}
                      {activityText(row)}
                    </p>
                    {row.book ? (
                      <Link to={`/books/${row.book.slug}`} className="fx-feed-link-2">
                        {row.book.title}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {nextCursor ? (
          <div className="mt-6 text-center">
            <Link to={`/feed?cursor=${nextCursor}`} className="link sans small">
              Older activity
            </Link>
          </div>
        ) : null}
      </Container>
    </PageShell>
  );
}
