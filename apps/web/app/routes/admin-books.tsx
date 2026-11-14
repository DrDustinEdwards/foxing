// Admin: Books. Search the catalog, toggle the staff-pick (featured) flag, and edit
// core metadata on a book. A featured book surfaces on the home and discovery rails.
// Reads in-process; writes to /api/v1/admin/books with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
  AdminRow,
  AdminField,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-books";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const q = new URL(request.url).searchParams.get("q")?.trim() || undefined;
  const books = await adminRepo.listBooksAdmin(db, { q });
  return { q: q ?? "", books };
}

export function meta() {
  return noindexMeta("Admin · Books | Foxing");
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };

export default function AdminBooks({ loaderData }: Route.ComponentProps) {
  const { q, books } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell title="Books">
      <div className="cap-stack" data-gap="6">
        <AdminCard title="Search">
          <form method="get" className="cap-cluster" data-gap="3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Title or author"
              className={adminInputClass}
            />
            <AdminButton variant="primary" type="submit">
              Search
            </AdminButton>
          </form>
        </AdminCard>

        <AdminCard title="Catalog">
          {books.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No books match this search.
            </p>
          ) : (
            <ul className="divided">
              {books.map((b) => (
                <BookRow key={b.id} book={b} onDone={() => void reload()} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function BookRow({
  book,
  onDone,
}: {
  book: Route.ComponentProps["loaderData"]["books"][number];
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useAdminAction({ onDone });

  return (
    <AdminRow
      title={
        <>
          {book.title}
          {book.isStaffPick ? <span className="badge ml-2">Featured</span> : null}
        </>
      }
      meta={
        <>
          {book.author}
          {book.publicationYear ? ` · ${book.publicationYear}` : ""} · {book.sourceType}
        </>
      }
      actions={
        <>
          <AdminButton pending={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit metadata"}
          </AdminButton>
          <AdminButton
            pending={pending}
            onClick={() =>
              void run(
                `/books/${book.id}/staff-pick`,
                { body: { on: !book.isStaffPick } },
                "Could not update",
              )
            }
          >
            {book.isStaffPick ? "Unfeature" : "Feature"}
          </AdminButton>
        </>
      }
    >
      {editing ? <BookEdit book={book} onDone={onDone} /> : null}
      <AdminError error={error} />
    </AdminRow>
  );
}

function BookEdit({
  book,
  onDone,
}: {
  book: Route.ComponentProps["loaderData"]["books"][number];
  onDone: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [publicationYear, setPublicationYear] = useState(
    book.publicationYear != null ? String(book.publicationYear) : "",
  );
  const [publisher, setPublisher] = useState("");
  const [description, setDescription] = useState("");
  const { pending, error, run } = useAdminAction({ onDone });

  async function save() {
    const year = publicationYear.trim();
    await run(
      `/books/${book.id}`,
      {
        method: "PATCH",
        body: {
          title: title.trim(),
          author: author.trim(),
          publicationYear: year ? Number(year) : null,
          publisher: publisher.trim() || undefined,
          description: description.trim() || undefined,
        },
      },
      "Could not save the book",
    );
  }

  return (
    <div className="mt-3 fx-admin-books-card">
      <div className="fx-admin-books-grid">
        <AdminField label="Title" value={title} onChange={setTitle} />
        <AdminField label="Author" value={author} onChange={setAuthor} />
        <AdminField
          label="Publication year"
          value={publicationYear}
          onChange={setPublicationYear}
          type="number"
        />
        <AdminField label="Publisher" value={publisher} onChange={setPublisher} />
      </div>
      <AdminField label="Description" value={description} onChange={setDescription} rows={4} />
      <AdminButton variant="primary" pending={pending} onClick={() => void save()}>
        {pending ? "Saving..." : "Save"}
      </AdminButton>
      <AdminError error={error} />
    </div>
  );
}
