// Admin: Book of the Month. Create a monthly pick (attach a catalog book, curator note),
// publish/unpublish, and delete. A published row with a book is what makes Today's Pick
// and the BOTM surfaces render. Reads in-process; writes to /api/v1/admin/botm with a
// visible error on failure.
import { MONTH_NAMES } from "@foxing/client";
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

export default function AdminBotm({ loaderData }: Route.ComponentProps) {
  const { rows } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">Book of the Month</h1>
      </div>

      <div className="stack-6">
        <CreateBotm onDone={reload} />
        <AdminCard title="Scheduled picks">
          {rows.length === 0 ? (
            <p className="meta">No picks yet. Create one above.</p>
          ) : (
            <ul className="divided">
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
      <div className="stack">
        <div className="fx-admin-botm-grid">
          <label className="block">
            <span className="fx-label">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={adminInputClass}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="fx-label">Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={adminInputClass}
            />
          </label>
        </div>
        <div>
          <span className="fx-label">Book</span>
          <BookPicker
            selected={book}
            onPick={(b) => setBook(b ? { id: b.id, title: b.title, author: b.author } : null)}
          />
        </div>
        <label className="block">
          <span className="fx-label">Category (optional)</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="fx-label">Curator note (optional)</span>
          <textarea
            value={curatorNote}
            onChange={(e) => setCuratorNote(e.target.value)}
            rows={3}
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="fx-label">Bookshop.org link (optional)</span>
          <input
            type="url"
            value={bookshopUrl}
            onChange={(e) => setBookshopUrl(e.target.value)}
            placeholder="https://bookshop.org/..."
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="fx-label">Amazon link (optional)</span>
          <input
            type="url"
            value={amazonUrl}
            onChange={(e) => setAmazonUrl(e.target.value)}
            placeholder="https://www.amazon.com/..."
            className={adminInputClass}
          />
        </label>
        <label className="row-2 ui">
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
      <div className="row spread">
        <div className="min-0">
          <p className="sans small strong">
            {MONTH_NAMES[row.month - 1]} {row.year}
            {row.isPublished ? (
              <span className="badge ml-2">Live</span>
            ) : (
              <span className="badge badge-quiet ml-2">Draft</span>
            )}
          </p>
          <p className="truncate meta">
            {row.bookTitle ? `${row.bookTitle} by ${row.bookAuthor}` : "No book attached"}
          </p>
        </div>
        <div className="row-2 shrink-0">
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
