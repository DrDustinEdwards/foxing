// Admin: Analytics. Read-only. At-a-glance platform counts plus the full recent operator
// audit log. Gated on ADMIN_EMAIL and CO_OWNER_EMAILS; adminRepo reads run in-process.
import { adminRepo, createDb } from "@foxing/core";
import { Table } from "capsomer/react/table";
import { mediumDateTime } from "~/lib/dates";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-analytics";

// The audit table is the only Capsomer table on the site, so its styles load with this page alone.
import "capsomer/table.css";

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
        <h1 className="cap-title" data-size="2">
          Analytics
        </h1>
      </div>

      <div className="fx-admin-analytics-grid">
        {tiles.map((t) => (
          <div key={t.label} className="cap-card">
            <p className="cap-title" data-size="2">
              {t.value}
            </p>
            <p className="fx-admin-analytics-caps">{t.label}</p>
            {t.sub ? <p className="fx-admin-analytics-text">{t.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <AdminCard title="Audit log">
          {audit.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No admin actions logged yet.
            </p>
          ) : (
            <Table caption="Recent admin actions" captionHidden>
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{a.action}</td>
                    <td>{a.actor ?? "System"}</td>
                    <td>{mediumDateTime.format(a.performedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
