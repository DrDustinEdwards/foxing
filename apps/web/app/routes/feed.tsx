import { activityText, useFeed } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Avatar, Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/feed";
import { noindexPageMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const page = await views.feed(createDb(env.DB), user.id, cursor);
  return { page, cursor };
}

export function meta() {
  return noindexPageMeta("Your feed | Foxing");
}

export default function Feed({ loaderData }: Route.ComponentProps) {
  const { rows, nextCursor } = useFeed(loaderData.cursor, loaderData.page).data;

  return (
    <PageShell>
      <Container>
        <PageHeader title="Feed" />

        <div className="cap-stack" data-gap="6">
          {rows.length === 0 ? (
            <EmptyState title="Your feed is quiet" />
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
                    <div className="cap-stack fx-feed-box" data-gap="1" data-align="start">
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
            <div className="cap-text" data-align="center">
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
        </div>
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };
