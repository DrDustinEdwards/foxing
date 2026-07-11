// Admin: Celebrity Picks. Filter the external curator clubs (Oprah, Reese, etc.),
// publish/unpublish their picks, and edit the curator copy on a pick. A published pick
// with a book is what renders on the /book-clubs surfaces. Reads in-process; writes to
// /api/v1/admin/picks with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { Link, useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { AdminButton, AdminError, adminInputClass, useAdminAction } from "~/components/admin/admin-form";
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

export default function AdminPicks({ loaderData }: Route.ComponentProps) {
  const { clubs, picks, clubId } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Celebrity Picks</h1>
      </div>

      <div className="space-y-6">
        <AdminCard title="Curator">
          <ul className="flex flex-wrap gap-1">
            <li>
              <Link
                to="/admin/celebrity-picks"
                className={filterClass(!clubId)}
              >
                All
              </Link>
            </li>
            {clubs.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/admin/celebrity-picks?club=${c.id}`}
                  className={filterClass(clubId === c.id)}
                >
                  {c.shortName || c.name}
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Picks">
          {picks.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No picks for this curator yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
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

function filterClass(active: boolean) {
  return active
    ? "block rounded-md bg-brand-subtle px-3 py-2 font-ui text-sm text-brand-subtle-text"
    : "block rounded-md px-3 py-2 font-ui text-sm text-secondary hover:bg-hover hover:text-primary";
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium text-primary">
            {pick.clubName}
            {pick.isPublished ? (
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
            {pick.bookTitle ?? "No book"}
            {pick.pickYear ? ` · ${pick.pickMonth ? `${pick.pickMonth}/` : ""}${pick.pickYear}` : ""}
            {pick.category ? ` · ${pick.category}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AdminButton pending={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </AdminButton>
          <AdminButton
            pending={pending}
            onClick={() =>
              run(`/picks/${pick.id}/publish`, { body: { on: !pick.isPublished } }, "Could not update")
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
    <div className="mt-3 space-y-3 rounded-md border border-border-subtle bg-sunken p-4">
      <label className="block">
        <span className="mb-1 block font-ui text-sm text-secondary">Category</span>
        <input value={category} onChange={(e) => setCategory(e.target.value)} className={adminInputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block font-ui text-sm text-secondary">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={adminInputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block font-ui text-sm text-secondary">Curator quote</span>
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
