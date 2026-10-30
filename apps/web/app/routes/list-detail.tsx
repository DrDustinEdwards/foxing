// Reading list at /lists/:id. Public lists are visible to anyone; a private list only
// to its owner (enforced in views.listPage). The owner can add/remove books and edit;
// any signed-in viewer can like the list (reactions, target_type='reading_list').
import { useListPage } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { AddBookToList } from "~/components/social/add-book-to-list";
import { LikeButton } from "~/components/social/like-button";
import { RemoveBookButton } from "~/components/social/remove-book-button";
import { Avatar, Container, EmptyState } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/list-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  const viewerId = session?.user?.id ?? null;
  const page = await views.listPage(createDb(env.DB), params.id, viewerId);
  if (!page) throw new Response("Not found", { status: 404 });
  return { page, signedIn: !!viewerId };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `${data?.page.list.title ?? "List"} | Foxing` },
    { name: "robots", content: data?.page.list.isPublic ? "index" : "noindex" },
  ];
}

export default function ListDetail({ loaderData }: Route.ComponentProps) {
  const { signedIn } = loaderData;
  const { list, owner, isOwner, likeCount, liked, books } = useListPage(
    loaderData.page.list.id,
    loaderData.page,
  ).data;

  return (
    <PageShell>
      <Container className="stack-8">
        <header className="stack">
          <div className="row-4 spread top">
            <div>
              <h1 className="display-4">{list.title}</h1>
              {owner ? (
                <Link to={`/u/${owner.username}`} className="mt-2 fx-list-detail-link">
                  <Avatar
                    src={owner.avatarUrl}
                    name={owner.displayName ?? owner.username}
                    size="sm"
                  />
                  {owner.displayName ?? owner.username}
                </Link>
              ) : null}
            </div>
            <div className="row">
              <LikeButton
                targetType="reading_list"
                targetId={list.id}
                liked={liked}
                count={likeCount}
                signedIn={signedIn}
              />
              {isOwner ? (
                <Link to={`/lists/${list.id}/edit`} className="cap-btn">
                  Edit
                </Link>
              ) : null}
            </div>
          </div>
          {list.description ? <p className="fx-list-detail-text">{list.description}</p> : null}
        </header>

        {isOwner ? <AddBookToList listId={list.id} /> : null}

        {books.length === 0 ? (
          <EmptyState
            title="No books yet"
            body={isOwner ? "Search above to add books." : undefined}
          />
        ) : (
          <ol className="stack-3">
            {books.map((entry, i) => (
              <li key={entry.bookId} className="fx-list-detail-card">
                <div className="fx-list-detail-row">
                  <span className="fx-list-detail-label">{i + 1}</span>
                  <div className="min-0">
                    {entry.book ? (
                      <Link to={`/books/${entry.book.slug}`} className="fx-list-detail-link-2">
                        {entry.book.title}
                      </Link>
                    ) : (
                      <span className="fx-list-detail-title">Unavailable book</span>
                    )}
                    {entry.book ? <p className="ui">{entry.book.author}</p> : null}
                    {entry.note ? <p className="mt-1 fx-list-detail-text-2">{entry.note}</p> : null}
                  </div>
                </div>
                {isOwner ? <RemoveBookButton listId={list.id} bookId={entry.bookId} /> : null}
              </li>
            ))}
          </ol>
        )}
      </Container>
    </PageShell>
  );
}
