// Admin: Book of the Month. Create a monthly pick (attach a catalog book, curator note),
// publish/unpublish, and delete. A published row with a book is what makes Today's Pick
// and the BOTM surfaces render. Reads in-process; writes to /api/v1/admin/botm with a
// visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { AdminButton, AdminError, adminInputClass, useAdminAction } from "~/components/admin/admin-form";
import { BookPicker } from "~/components/admin/book-picker";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-botm";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const rows = await adminRepo.listBotmAdmin(createDb(env.DB));
  return { rows };
}

export function meta() {
  return [{ title: "Admin · Book of the Month | Foxing" }, { name: "robots", content: "noindex" }];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function AdminBotm({ loaderData }: Route.ComponentProps) {
  const { rows } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Book of the Month</h1>
      </div>

      <div className="space-y-6">
        <CreateBotm onDone={reload} />
        <AdminCard title="Scheduled picks">
          {rows.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No picks yet. Create one above.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <BotmRow key={r.id} row={r} onDone={reload} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function CreateBotm({ onDone }: { onDone: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [book, setBook] = useState<{ id: string; title: string; author: string } | null>(null);
  const [category, setCategory] = useState("");
  const [curatorNote, setCuratorNote] = useState("");
  const [bookshopUrl, setBookshopUrl] = useState("");
  const [amazonUrl, setAmazonUrl] = useState("");
  const [publish, setPublish] = useState(false);
  const { pending, error, setError, run } = useAdminAction({ onDone });

  async function create() {
    if (!book) {
      setError("Pick a book for the month.");
      return;
    }
    const result = await run(
      "/botm",
      {
        body: {
          bookId: book.id,
          year,
          month,
          category: category.trim() || null,
          curatorNote: curatorNote.trim() || null,
          bookshopUrl: bookshopUrl.trim() || null,
          amazonUrl: amazonUrl.trim() || null,
          isPublished: publish,
        },
      },
      "Could not create the pick",
    );
    if (result) {
      setBook(null);
      setCategory("");
      setCuratorNote("");
      setBookshopUrl("");
      setAmazonUrl("");
      setPublish(false);
    }
  }

  return (
    <AdminCard title="New pick">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-ui text-sm text-secondary">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={adminInputClass}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-ui text-sm text-secondary">Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={adminInputClass}
            />
          </label>
        </div>
        <div>
          <span className="mb-1 block font-ui text-sm text-secondary">Book</span>
          <BookPicker
            selected={book}
            onPick={(b) => setBook(b ? { id: b.id, title: b.title, author: b.author } : null)}
          />
        </div>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Category (optional)</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Curator note (optional)</span>
          <textarea
            value={curatorNote}
            onChange={(e) => setCuratorNote(e.target.value)}
            rows={3}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">
            Bookshop.org link (optional)
          </span>
          <input
            type="url"
            value={bookshopUrl}
            onChange={(e) => setBookshopUrl(e.target.value)}
            placeholder="https://bookshop.org/..."
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Amazon link (optional)</span>
          <input
            type="url"
            value={amazonUrl}
            onChange={(e) => setAmazonUrl(e.target.value)}
            placeholder="https://www.amazon.com/..."
            className={adminInputClass}
          />
        </label>
        <label className="flex items-center gap-2 font-ui text-sm text-secondary">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish immediately
        </label>
        <AdminButton variant="primary" pending={pending} onClick={create}>
          {pending ? "Creating..." : "Create pick"}
        </AdminButton>
        <AdminError error={error} />
      </div>
    </AdminCard>
  );
}

function BotmRow({
  row,
  onDone,
}: {
  row: Route.ComponentProps["loaderData"]["rows"][number];
  onDone: () => void;
}) {
  const { pending, error, run } = useAdminAction({ onDone });

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium text-primary">
            {MONTHS[row.month - 1]} {row.year}
            {row.isPublished ? (
              <span className="ml-2 rounded-full bg-brand-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-brand-subtle-text">
                Live
              </span>
            ) : (
              <span className="ml-2 rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-tertiary">
                Draft
              </span>
            )}
          </p>
          <p className="truncate font-ui text-sm text-tertiary">
            {row.bookTitle ? `${row.bookTitle} by ${row.bookAuthor}` : "No book attached"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AdminButton
            pending={pending}
            onClick={() =>
              run(`/botm/${row.id}/publish`, { body: { on: !row.isPublished } }, "Could not update")
            }
          >
            {row.isPublished ? "Unpublish" : "Publish"}
          </AdminButton>
          <AdminButton
            variant="danger"
            pending={pending}
            onClick={() => run(`/botm/${row.id}`, { method: "DELETE" }, "Could not delete")}
          >
            Delete
          </AdminButton>
        </div>
      </div>
      <AdminError error={error} />
    </li>
  );
}
