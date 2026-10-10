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
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-books";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const q = new URL(request.url).searchParams.get("q")?.trim() || undefined;
  const books = await adminRepo.listBooksAdmin(db, { q });
  return { q: q ?? "", books };
}

export function meta() {
  return [{ title: "Admin · Books | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function AdminBooks({ loaderData }: Route.ComponentProps) {
  const { q, books } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Books</h1>
      </div>

      <div className="space-y-6">
        <AdminCard title="Search">
          <form method="get" className="flex gap-2">
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
            <p className="font-ui text-sm text-tertiary">No books match this search.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {books.map((b) => (
                <BookRow key={b.id} book={b} onDone={reload} />
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
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium text-primary">
            {book.title}
            {book.isStaffPick ? (
              <span className="ml-2 rounded-full bg-brand-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-brand-subtle-text">
                Featured
              </span>
            ) : null}
          </p>
          <p className="truncate font-ui text-sm text-tertiary">
            {book.author}
            {book.publicationYear ? ` · ${book.publicationYear}` : ""} · {book.sourceType}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AdminButton pending={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit metadata"}
          </AdminButton>
          <AdminButton
            pending={pending}
            onClick={() =>
              run(
                `/books/${book.id}/staff-pick`,
                { body: { on: !book.isStaffPick } },
                "Could not update",
              )
            }
          >
            {book.isStaffPick ? "Unfeature" : "Feature"}
          </AdminButton>
        </div>
      </div>
      {editing ? <BookEdit book={book} onDone={onDone} /> : null}
      <AdminError error={error} />
    </li>
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
    <div className="mt-3 space-y-3 rounded-md border border-border-subtle bg-sunken p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Author</span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Publication year</span>
          <input
            type="number"
            value={publicationYear}
            onChange={(e) => setPublicationYear(e.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Publisher</span>
          <input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className={adminInputClass}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block font-ui text-sm text-secondary">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={adminInputClass}
        />
      </label>
      <AdminButton variant="primary" pending={pending} onClick={save}>
        {pending ? "Saving..." : "Save"}
      </AdminButton>
      <AdminError error={error} />
    </div>
  );
}
