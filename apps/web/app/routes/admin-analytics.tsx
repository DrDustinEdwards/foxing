// Admin: Analytics. Read-only. At-a-glance platform counts plus the full recent operator
// audit log. Gated on ADMIN_EMAIL and CO_OWNER_EMAILS; adminRepo reads run in-process.
import { adminRepo, createDb } from "@foxing/core";
import { mediumDateTime } from "~/lib/dates";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-analytics";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const [stats, audit] = await Promise.all([
    adminRepo.getAdminStats(db),
    adminRepo.listAuditLog(db, 50),
  ]);
  return { stats, audit };
}

export function meta() {
  return [{ title: "Admin · Analytics | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { stats, audit } = loaderData;
  const tiles = [
    { label: "readers", value: stats.totalUsers, sub: `${stats.plusUsers} Plus` },
    { label: "suspended", value: stats.suspendedUsers, sub: null },
    { label: "books", value: stats.totalBooks, sub: `${stats.staffPicks} featured` },
    { label: "clubs", value: stats.totalClubs, sub: null },
    { label: "journal live", value: stats.publishedJournal, sub: null },
    { label: "BOTM live", value: stats.publishedBotm, sub: null },
  ];

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="group-label">Admin</p>
        <h1 className="display-3">Analytics</h1>
      </div>

      <div className="fx-admin-analytics-grid">
        {tiles.map((t) => (
          <div key={t.label} className="cap-card">
            <p className="display-3">{t.value}</p>
            <p className="fx-admin-analytics-caps">{t.label}</p>
            {t.sub ? <p className="fx-admin-analytics-text">{t.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <AdminCard title="Audit log">
          {audit.length === 0 ? (
            <p className="cap-meta sans">No admin actions logged yet.</p>
          ) : (
            <div className="fx-admin-analytics-box">
              <table className="fx-admin-analytics-table">
                <thead>
                  <tr className="fx-admin-analytics-tr">
                    <th className="fx-admin-analytics-caps-2">Action</th>
                    <th className="fx-admin-analytics-caps-2">Actor</th>
                    <th className="fx-admin-analytics-caps-2">When</th>
                  </tr>
                </thead>
                <tbody className="divided">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 fx-admin-analytics-td">{a.action}</td>
                      <td className="py-2 fx-admin-analytics-td-2">{a.actor ?? "System"}</td>
                      <td className="py-2 fx-admin-analytics-td-3">
                        {mediumDateTime.format(a.performedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
