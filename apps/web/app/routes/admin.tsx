// Admin dashboard: at-a-glance counts, recent signups, and the recent operator audit
// log. Read-only, gated on profiles.is_admin. This is the template every other admin
// page follows: requireAdmin in the loader, adminRepo reads in-process, AdminShell chrome.
import { adminRepo, createDb } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const [stats, audit] = await Promise.all([
    adminRepo.getAdminStats(db),
    adminRepo.listAuditLog(db, 12),
  ]);
  return { stats, audit };
}

export function meta() {
  return [{ title: "Admin | Foxing" }, { name: "robots", content: "noindex" }];
}

const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const { stats, audit } = loaderData;
  const tiles = [
    { label: "readers", value: stats.totalUsers, sub: `${stats.plusUsers} Plus` },
    { label: "books", value: stats.totalBooks, sub: `${stats.staffPicks} featured` },
    { label: "clubs", value: stats.totalClubs, sub: null },
    { label: "journal live", value: stats.publishedJournal, sub: null },
    { label: "BOTM live", value: stats.publishedBotm, sub: null },
    { label: "suspended", value: stats.suspendedUsers, sub: null },
  ];

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">Dashboard</h1>
      </div>

      <div className="fx-admin-grid">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <p className="display-3">{t.value}</p>
            <p className="mt-1 fx-admin-caps">{t.label}</p>
            {t.sub ? <p className="mt-1 fx-admin-text">{t.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-8 fx-admin-grid-2">
        <AdminCard title="Recent signups">
          {stats.recentSignups.length === 0 ? (
            <p className="meta">No readers yet.</p>
          ) : (
            <ul className="divided">
              {stats.recentSignups.map((u) => (
                <li key={u.id} className="py-2 row spread">
                  <Link to={`/admin/users/${u.id}`} className="fx-admin-link">
                    @{u.username}
                  </Link>
                  <span className="mono fine">
                    {u.tier === "plus" ? "Plus" : "Free"} · {fmt.format(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Recent admin actions">
          {audit.length === 0 ? (
            <p className="meta">No admin actions logged yet.</p>
          ) : (
            <ul className="divided">
              {audit.map((a) => (
                <li key={a.id} className="py-2 row spread">
                  <span className="fx-admin-label">{a.action}</span>
                  <span className="mono fine">{fmt.format(a.performedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
