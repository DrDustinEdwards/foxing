// Admin: Celebrity Picks. Filter the external curator clubs (Oprah, Reese, etc.),
// publish/unpublish their picks, and edit the curator copy on a pick. A published pick
// with a book is what renders on the /book-clubs surfaces. Reads in-process; writes to
// /api/v1/admin/picks with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { Link } from "capsomer/react/link";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-picks";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const clubId = new URL(request.url).searchParams.get("club") || undefined;
  const [clubs, picks] = await Promise.all([
    adminRepo.listPickClubsAdmin(db),
    adminRepo.listPicksAdmin(db, clubId),
  ]);
  return { clubs, picks, clubId: clubId ?? null };
}

export function meta() {
  return [{ title: "Admin · Celebrity Picks | Foxing" }, { name: "robots", content: "noindex" }];
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };

export default function AdminPicks({ loaderData }: Route.ComponentProps) {
  const { clubs, picks, clubId } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">Celebrity Picks</h1>
      </div>

      <div className="stack-6">
        <AdminCard title="Curator">
          <ul className="fx-admin-picks-row">
            <li>
              <Link
                to="/admin/celebrity-picks"
                className="fx-admin-nav-link"
                aria-current={!clubId ? "page" : undefined}
              >
                All
              </Link>
            </li>
            {clubs.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/admin/celebrity-picks?club=${c.id}`}
                  className="fx-admin-nav-link"
                  aria-current={clubId === c.id ? "page" : undefined}
                >
                  {c.shortName || c.name}
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Picks">
          {picks.length === 0 ? (
            <p className="meta">No picks for this curator yet.</p>
          ) : (
            <ul className="divided">
              {picks.map((p) => (
                <PickRow key={p.id} pick={p} onDone={reload} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function PickRow({
  pick,
  onDone,
}: {
  pick: Route.ComponentProps["loaderData"]["picks"][number];
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useAdminAction({ onDone });

  return (
    <li className="py-3">
      <div className="row spread">
        <div className="min-0">
          <p className="sans small strong">
            {pick.clubName}
            {pick.isPublished ? (
              <span className="badge ml-2">Live</span>
            ) : (
              <span className="badge badge-quiet ml-2">Draft</span>
            )}
          </p>
          <p className="truncate meta">
            {pick.bookTitle ?? "No book"}
            {pick.pickYear
              ? ` · ${pick.pickMonth ? `${pick.pickMonth}/` : ""}${pick.pickYear}`
              : ""}
            {pick.category ? ` · ${pick.category}` : ""}
          </p>
        </div>
        <div className="row-2 shrink-0">
          <AdminButton pending={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </AdminButton>
          <AdminButton
            pending={pending}
            onClick={() =>
              run(
                `/picks/${pick.id}/publish`,
                { body: { on: !pick.isPublished } },
                "Could not update",
              )
            }
          >
            {pick.isPublished ? "Unpublish" : "Publish"}
          </AdminButton>
        </div>
      </div>
      {editing ? <PickEdit pick={pick} onDone={onDone} /> : null}
      <AdminError error={error} />
    </li>
  );
}

function PickEdit({
  pick,
  onDone,
}: {
  pick: Route.ComponentProps["loaderData"]["picks"][number];
  onDone: () => void;
}) {
  const [category, setCategory] = useState(pick.category ?? "");
  const [notes, setNotes] = useState(pick.notes ?? "");
  const [curatorQuote, setCuratorQuote] = useState(pick.curatorQuote ?? "");
  const { pending, error, run } = useAdminAction({ onDone });

  async function save() {
    await run(
      `/picks/${pick.id}`,
      {
        method: "PATCH",
        body: {
          category: category.trim() || null,
          notes: notes.trim() || null,
          curatorQuote: curatorQuote.trim() || null,
        },
      },
      "Could not save the pick",
    );
  }

  return (
    <div className="mt-3 fx-admin-picks-card">
      <label className="block">
        <span className="fx-label">Category</span>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={adminInputClass}
        />
      </label>
      <label className="block">
        <span className="fx-label">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={adminInputClass}
        />
      </label>
      <label className="block">
        <span className="fx-label">Curator quote</span>
        <textarea
          value={curatorQuote}
          onChange={(e) => setCuratorQuote(e.target.value)}
          rows={2}
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
