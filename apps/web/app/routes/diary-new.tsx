// Create a diary entry at /diary/new?book=<slugOrId>. The book is resolved in the
// loader so the form has a title to show and an id to submit. Without a valid book the
// page explains how to start (from a book page). The form POSTs /api/v1/diary.
import { catalogRepo, createDb } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { DiaryBookPicker } from "~/components/social/diary-book-picker";
import { DiaryForm } from "~/components/social/diary-form";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/diary-new";

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
  return [{ title: "New diary entry | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function DiaryNew({ loaderData }: Route.ComponentProps) {
  const { book, username } = loaderData;
  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Diary" title="Log a book" />
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
        <p className="mt-6 fx-diary-new-text">
          <Link to="/library" className="link">
            Go to your library
          </Link>
        </p>
      </Container>
    </PageShell>
  );
}
