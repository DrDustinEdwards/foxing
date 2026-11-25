import { Table } from "capsomer/react/table";
import { mediumDateTime } from "~/lib/dates";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { adminLoaderBase, adminOverview } from "~/lib/admin.server";
import type { Route } from "./+types/admin-analytics";

import "capsomer/table.css";
import { noindexPageMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = await adminLoaderBase(context, request);
  return adminOverview(db, 50);
}

export function meta() {
  return noindexPageMeta("Admin · Analytics | Foxing");
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
    <AdminShell title="Analytics">
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
    </AdminShell>
  );
}

export const handle = { hydrate: true };
