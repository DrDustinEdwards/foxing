import { useShelf } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/shelf-detail";
import { noindexMeta } from "~/lib/seo";
export { ErrorBoundary } from "~/components/route-error";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const detail = await views.shelfDetail(createDb(env.DB), user.id, params.id);
  if (!detail) throw new Response("Not found", { status: 404 });
  return detail;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return noindexMeta(loaderData ? `${loaderData.shelf.name} | Foxing` : "Shelf | Foxing");
}

export default function ShelfDetail({ loaderData }: Route.ComponentProps) {
  // Lives in the cache, so a book taken off this shelf elsewhere drops out here too.
  const { shelf, books } = useShelf(loaderData.shelf.id, loaderData).data;
  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <div className="cap-stack" data-gap="3">
          <p>
            <Link to="/library" className="fx-shelf-detail-link">
              All shelves
            </Link>
          </p>
          <h1 className="fx-shelf-detail-title">{shelf.name}</h1>
          {shelf.description ? <p className="fx-shelf-detail-text">{shelf.description}</p> : null}
        </div>

        <div className="cap-stack" data-gap="5">
          <p className="cap-meta">
            {books.length} {books.length === 1 ? "book" : "books"}
          </p>
          {books.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No books yet.
            </p>
          ) : (
            <BookGrid>
              {books.map((b) => (
                <BookCard key={b.slug} book={b} headingLevel={2} />
              ))}
            </BookGrid>
          )}
        </div>
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
