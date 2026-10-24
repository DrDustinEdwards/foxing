// Edit a diary entry at /diary/:id/edit. Owner-gated in the loader (a non-owner or
// missing entry 404s). The form PATCHes /api/v1/diary/:id. Editing does not re-emit a
// feed event (create-only rule), but the rating aggregate recomputes in core.
import { catalogRepo, createDb, diaryRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { DiaryForm } from "~/components/social/diary-form";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/diary-edit";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const entry = await diaryRepo.getEntryById(db, params.id);
  if (!entry || entry.userId !== user.id) throw new Response("Not found", { status: 404 });
  const book = await catalogRepo.getBookById(db, entry.bookId);
  return {
    username: profile.username,
    entry: {
      id: entry.id,
      bookId: entry.bookId,
      bookTitle: book?.title ?? "your book",
      ratingHalf: entry.ratingHalf,
      review: entry.review,
      containsSpoilers: entry.containsSpoilers,
      visibility: entry.visibility as "private" | "friends" | "public",
    },
  };
}

export function meta() {
  return [{ title: "Edit diary entry | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function DiaryEdit({ loaderData }: Route.ComponentProps) {
  const { entry, username } = loaderData;
  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Diary" title="Edit entry" />
        <DiaryForm
          mode="edit"
          entryId={entry.id}
          bookId={entry.bookId}
          bookTitle={entry.bookTitle}
          redirectTo={`/u/${username}`}
          initial={{
            ratingHalf: entry.ratingHalf,
            review: entry.review,
            containsSpoilers: entry.containsSpoilers,
            visibility: entry.visibility,
          }}
        />
      </Container>
    </PageShell>
  );
}
