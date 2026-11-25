import { catalogRepo, createDb } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { DiaryBookPicker } from "~/components/social/diary-book-picker";
import { DiaryForm } from "~/components/social/diary-form";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/diary-new";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { profile } = await requireProfile(env, request);
  const bookParam = new URL(request.url).searchParams.get("book");
  if (!bookParam) return { book: null, username: profile.username };
  const db = createDb(env.DB);
  const book =
    (await catalogRepo.getBookBySlug(db, bookParam)) ??
    (await catalogRepo.getBookById(db, bookParam));
  return {
    book: book ? { id: book.id, title: book.title } : null,
    username: profile.username,
  };
}

export function meta() {
  return noindexMeta("New diary entry | Foxing");
}

export default function DiaryNew({ loaderData }: Route.ComponentProps) {
  const { book, username } = loaderData;
  return (
    <PageShell>
      <Container>
        <PageHeader title="Log a book" />
        <div className="cap-stack" data-gap="6">
          {book ? (
            <DiaryForm
              mode="create"
              bookId={book.id}
              bookTitle={book.title}
              redirectTo={`/u/${username}`}
            />
          ) : (
            <DiaryBookPicker />
          )}
          <p className="fx-diary-new-text">
            <Link to="/library" className="link">
              Go to your library
            </Link>
          </p>
        </div>
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };
