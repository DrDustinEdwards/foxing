// The activity feed at /feed. Aggregates events from people you follow (public) and
// people whose close-friends list includes you (friends-only), plus your own new-follower
// notices. Visibility resolves entirely server-side in core; the loader receives only
// what the viewer is entitled to see.
import { activityText, useFeed } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Avatar, Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/feed";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const page = await views.feed(createDb(env.DB), user.id, cursor);
  return { page, cursor };
}

export function meta() {
  return noindexMeta("Your feed | Foxing");
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
          <ul className="cap-stack" data-gap="4">
            {rows.map((row) =>
              row.kind === "follower" ? (
                <li key={`f-${row.id}`} className="py-3 fx-feed-card">
                  {row.actorLabel}
                </li>
              ) : (
                <li key={`a-${row.id}`} className="items-start cap-card fx-feed-card-2">
                  <Avatar
                    src={row.actor?.avatarUrl ?? null}
                    name={row.actor?.displayName ?? row.actor?.username ?? "Reader"}
                    size="sm"
                  />
                  <div className="fx-feed-box">
                    <p className="cap-text" data-tone="muted">
                      {row.actor ? (
                        <Link to={`/u/${row.actor.username}`} className="fx-feed-link">
                          {row.actor.displayName ?? row.actor.username}
                        </Link>
                      ) : (
                        <span className="cap-text" data-tone="ink" data-weight="strong">
                          Someone
                        </span>
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
          <div className="cap-text mt-6" data-align="center">
            <Link
              to={`/feed?cursor=${encodeURIComponent(nextCursor)}`}
              className="cap-text link"
              data-size="small"
              data-face="ui"
            >
              Older activity
            </Link>
          </div>
        ) : null}
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
