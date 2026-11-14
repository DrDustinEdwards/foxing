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
  AdminRow,
  AdminField,
} from "~/components/admin/admin-form";
import { BookPicker } from "~/components/admin/book-picker";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-botm";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const rows = await adminRepo.listBotmAdmin(createDb(env.DB));
  return { rows };
}

export function meta() {
  return noindexMeta("Admin · Book of the Month | Foxing");
}

export default function AdminBotm({ loaderData }: Route.ComponentProps) {
  const { rows } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell title="Book of the Month">
      <div className="cap-stack" data-gap="6">
        <CreateBotm onDone={() => void reload()} />
        <AdminCard title="Scheduled picks">
          {rows.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No picks yet. Create one above.
            </p>
          ) : (
            <ul className="divided">
              {rows.map((r) => (
                <BotmRow key={r.id} row={r} onDone={() => void reload()} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function CreateBotm({ onDone }: { onDone: () => void }) {
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [month, setMonth] = useState(() => new Date().getUTCMonth() + 1);
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
      <div className="cap-stack">
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
        <BookPicker
          label="Book"
          selected={book}
          onPick={(b) => setBook(b ? { id: b.id, title: b.title, author: b.author } : null)}
        />
        <AdminField label="Category (optional)" value={category} onChange={setCategory} />
        <AdminField
          label="Curator note (optional)"
          value={curatorNote}
          onChange={setCuratorNote}
          rows={3}
        />
        <AdminField
          label="Bookshop.org link (optional)"
          value={bookshopUrl}
          onChange={setBookshopUrl}
          type="url"
          placeholder="https://bookshop.org/..."
        />
        <AdminField
          label="Amazon link (optional)"
          value={amazonUrl}
          onChange={setAmazonUrl}
          type="url"
          placeholder="https://www.amazon.com/..."
        />
        <label
          className="cap-text cap-cluster"
          data-size="small"
          data-tone="muted"
          data-face="ui"
          data-gap="3"
        >
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish immediately
        </label>
        <AdminButton variant="primary" pending={pending} onClick={() => void create()}>
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
    <AdminRow
      title={
        <>
          {MONTH_NAMES[row.month - 1]} {row.year}
          {row.isPublished ? (
            <span className="badge ml-2">Live</span>
          ) : (
            <span className="badge badge-quiet ml-2">Draft</span>
          )}
        </>
      }
      meta={<>{row.bookTitle ? `${row.bookTitle} by ${row.bookAuthor}` : "No book attached"}</>}
      actions={
        <>
          <AdminButton
            pending={pending}
            onClick={() =>
              void run(
                `/botm/${row.id}/publish`,
                { body: { on: !row.isPublished } },
                "Could not update",
              )
            }
          >
            {row.isPublished ? "Unpublish" : "Publish"}
          </AdminButton>
          <AdminButton
            variant="danger"
            pending={pending}
            onClick={() => void run(`/botm/${row.id}`, { method: "DELETE" }, "Could not delete")}
          >
            Delete
          </AdminButton>
        </>
      }
    >
      <AdminError error={error} />
    </AdminRow>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
