// Admin: Clubs. Search user reading clubs, toggle the verified badge, and delete a club
// (destructive, two-step confirm). Reads in-process; writes to /api/v1/admin/clubs with a
// visible error on failure.
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
import type { Route } from "./+types/admin-clubs";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const q = new URL(request.url).searchParams.get("q")?.trim() || undefined;
  const clubs = await adminRepo.listClubsAdmin(db, { q });
  return { q: q ?? "", clubs };
}

export function meta() {
  return [{ title: "Admin · Clubs | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function AdminClubs({ loaderData }: Route.ComponentProps) {
  const { q, clubs } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">Clubs</h1>
      </div>

      <div className="stack-6">
        <AdminCard title="Search">
          <form method="get" className="row-2">
            <input name="q" defaultValue={q} placeholder="Club name" className={adminInputClass} />
            <AdminButton variant="primary" type="submit">
              Search
            </AdminButton>
          </form>
        </AdminCard>

        <AdminCard title="Clubs">
          {clubs.length === 0 ? (
            <p className="meta">No clubs match this search.</p>
          ) : (
            <ul className="divided">
              {clubs.map((c) => (
                <ClubRow key={c.id} club={c} onDone={reload} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function ClubRow({
  club,
  onDone,
}: {
  club: Route.ComponentProps["loaderData"]["clubs"][number];
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = useAdminAction({ onDone });

  return (
    <li className="py-3">
      <div className="row spread">
        <div className="min-0">
          <p className="sans small strong">
            {club.name}
            {club.isVerified ? (
              <span className="badge ml-2">Verified</span>
            ) : (
              <span className="badge badge-quiet ml-2">Unverified</span>
            )}
          </p>
          <p className="truncate meta">
            {club.slug ? `/${club.slug}` : "No slug"} · {club.visibility}
          </p>
        </div>
        <div className="shrink-0 row-2">
          {club.slug ? (
            <Link to={`/clubs/${club.slug}`} className="cap-btn">
              View
            </Link>
          ) : null}
          <AdminButton
            pending={pending}
            onClick={() =>
              run(
                `/clubs/${club.id}/verify`,
                { body: { on: !club.isVerified } },
                "Could not update",
              )
            }
          >
            {club.isVerified ? "Unverify" : "Verify"}
          </AdminButton>
          {confirming ? (
            <>
              <AdminButton
                variant="danger"
                pending={pending}
                onClick={() => run(`/clubs/${club.id}`, { method: "DELETE" }, "Could not delete")}
              >
                Confirm delete
              </AdminButton>
              <AdminButton pending={pending} onClick={() => setConfirming(false)}>
                Cancel
              </AdminButton>
            </>
          ) : (
            <AdminButton variant="danger" pending={pending} onClick={() => setConfirming(true)}>
              Delete
            </AdminButton>
          )}
        </div>
      </div>
      <AdminError error={error} />
    </li>
  );
}
