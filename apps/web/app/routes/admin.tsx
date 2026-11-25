import { Link } from "capsomer/react/link";
import { mediumDateTime } from "~/lib/dates";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { adminLoaderBase, adminOverview } from "~/lib/admin.server";
import type { Route } from "./+types/admin";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = await adminLoaderBase(context, request);
  return adminOverview(db, 12);
}

export function meta() {
  return noindexMeta("Admin | Foxing");
}

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
    <AdminShell title="Overview">
      <div className="fx-admin-grid">
        {tiles.map((t) => (
          <div key={t.label} className="cap-card">
            <p className="cap-title" data-size="2">
              {t.value}
            </p>
            <p className="fx-admin-caps">{t.label}</p>
            {t.sub ? <p className="fx-admin-text">{t.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="fx-admin-grid-2">
        <AdminCard title="Recent signups">
          {stats.recentSignups.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No readers yet.
            </p>
          ) : (
            <ul className="divided">
              {stats.recentSignups.map((u) => (
                <li key={u.id} className="py-2 cap-spread" data-gap="4" data-align="center">
                  <Link to={`/admin/users/${u.id}`} className="fx-admin-link">
                    @{u.username}
                  </Link>
                  <span className="cap-text" data-size="tiny" data-tone="dim" data-face="mono">
                    {u.tier === "plus" ? "Plus" : "Free"} · {mediumDateTime.format(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Recent admin actions">
          {audit.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              No admin actions logged yet.
            </p>
          ) : (
            <ul className="divided">
              {audit.map((a) => (
                <li key={a.id} className="py-2 cap-spread" data-gap="4" data-align="center">
                  <span className="fx-admin-label">{a.action}</span>
                  <span className="cap-text" data-size="tiny" data-tone="dim" data-face="mono">
                    {mediumDateTime.format(a.performedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

export const handle = { hydrate: true };
