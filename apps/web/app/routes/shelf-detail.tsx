import { useShelf } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { redirect } from "react-router";
import { Link } from "capsomer/react/link";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/shelf-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/shelves/${params.id}`);
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const detail = await views.shelfDetail(createDb(env.DB), session.user.id, params.id);
  if (!detail) throw new Response("Not found", { status: 404 });
  return detail;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.shelf.name} | Foxing` : "Shelf | Foxing" },
    { name: "robots", content: "noindex" },
  ];
}

export default function ShelfDetail({ loaderData }: Route.ComponentProps) {
  // Lives in the cache, so a book taken off this shelf elsewhere drops out here too.
  const { shelf, books } = useShelf(loaderData.shelf.id, loaderData).data;
  return (
    <PageShell>
      <Container>
        <Link to="/library" className="fx-shelf-detail-link">
          All shelves
        </Link>
        <h1 className="mt-2 fx-shelf-detail-title">{shelf.name}</h1>
        {shelf.description ? (
          <p className="mt-2 fx-shelf-detail-text">{shelf.description}</p>
        ) : null}

        <div className="mt-8">
          <Eyebrow className="mb-4">
            {books.length} {books.length === 1 ? "book" : "books"}
          </Eyebrow>
          {books.length === 0 ? (
            <p className="meta">Add books to this shelf from any book page.</p>
          ) : (
            <BookGrid>
              {books.map((b) => (
                <BookCard key={b.slug} book={b} />
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
