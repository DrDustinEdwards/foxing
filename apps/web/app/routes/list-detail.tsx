// Reading list at /lists/:id. Public lists are visible to anyone; a private list only
// to its owner (enforced in loadListDetail). The owner can add/remove books and edit;
// any signed-in viewer can like the list (reactions, target_type='reading_list').
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { AddBookToList } from "~/components/social/add-book-to-list";
import { LikeButton } from "~/components/social/like-button";
import { RemoveBookButton } from "~/components/social/remove-book-button";
import { Avatar, Container, EmptyState } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { loadListDetail } from "~/lib/social.server";
import type { Route } from "./+types/list-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  const viewerId = session?.user?.id ?? null;
  const data = await loadListDetail(env, params.id, viewerId);
  if (!data) throw new Response("Not found", { status: 404 });
  return { ...data, signedIn: !!viewerId };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `${data?.list.title ?? "List"} | Foxing` },
    { name: "robots", content: data?.list.isPublic ? "index" : "noindex" },
  ];
}

export default function ListDetail({ loaderData }: Route.ComponentProps) {
  const { list, owner, isOwner, likeCount, liked, books, signedIn } = loaderData;

  return (
    <PageShell>
      <Container className="max-w-3xl flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl">{list.title}</h1>
              {owner ? (
                <Link
                  to={`/u/${owner.username}`}
                  className="mt-2 inline-flex items-center gap-2 font-ui text-sm text-secondary hover:text-brand-text"
                >
                  <Avatar
                    src={owner.avatarUrl}
                    name={owner.displayName ?? owner.username}
                    size="sm"
                  />
                  {owner.displayName ?? owner.username}
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <LikeButton
                targetType="reading_list"
                targetId={list.id}
                initialLiked={liked}
                initialCount={likeCount}
                signedIn={signedIn}
              />
              {isOwner ? (
                <Link
                  to={`/lists/${list.id}/edit`}
                  className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm text-primary hover:bg-hover"
                >
                  Edit
                </Link>
              ) : null}
            </div>
          </div>
          {list.description ? (
            <p className="max-w-2xl font-body text-secondary">{list.description}</p>
          ) : null}
        </header>

        {isOwner ? <AddBookToList listId={list.id} /> : null}

        {books.length === 0 ? (
          <EmptyState
            title="No books yet"
            body={isOwner ? "Search above to add books." : undefined}
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {books.map((entry, i) => (
              <li
                key={entry.bookId}
                className="flex items-center justify-between gap-4 rounded-card border border-border-subtle bg-surface p-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="font-mono text-sm text-tertiary">{i + 1}</span>
                  <div className="min-w-0">
                    {entry.book ? (
                      <Link
                        to={`/books/${entry.book.slug}`}
                        className="font-display text-lg text-primary hover:text-brand-text"
                      >
                        {entry.book.title}
                      </Link>
                    ) : (
                      <span className="font-display text-lg text-tertiary">Unavailable book</span>
                    )}
                    {entry.book ? (
                      <p className="font-ui text-sm text-secondary">{entry.book.author}</p>
                    ) : null}
                    {entry.note ? (
                      <p className="mt-1 font-body text-sm text-secondary">{entry.note}</p>
                    ) : null}
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
