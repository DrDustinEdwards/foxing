// Admin dashboard: at-a-glance counts, recent signups, and the recent operator audit
// log. Read-only, gated on profiles.is_admin. This is the template every other admin
// page follows: requireAdmin in the loader, adminRepo reads in-process, AdminShell chrome.
import { adminRepo, createDb } from "@foxing/core";
import { Link } from "react-router";
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
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-card border border-border-subtle bg-surface p-4">
            <p className="font-display text-3xl text-primary">{t.value}</p>
            <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">
              {t.label}
            </p>
            {t.sub ? <p className="mt-1 font-ui text-xs text-secondary">{t.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard title="Recent signups">
          {stats.recentSignups.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No readers yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {stats.recentSignups.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to={`/admin/users/${u.id}`}
                    className="font-ui text-sm text-secondary hover:text-brand-text"
                  >
                    @{u.username}
                  </Link>
                  <span className="font-mono text-xs text-tertiary">
                    {u.tier === "plus" ? "Plus" : "Free"} · {fmt.format(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Recent admin actions">
          {audit.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No admin actions logged yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-mono text-xs text-secondary">{a.action}</span>
                  <span className="font-mono text-xs text-tertiary">
                    {fmt.format(a.performedAt)}
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
