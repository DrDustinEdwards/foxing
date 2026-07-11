// Admin: Analytics. Read-only. At-a-glance platform counts plus the full recent operator
// audit log. Gated on profiles.is_admin; adminRepo reads run in-process.
import { adminRepo, createDb } from "@foxing/core";
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

const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

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
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Analytics</h1>
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

      <div className="mt-8">
        <AdminCard title="Audit log">
          {audit.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No admin actions logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="pb-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">
                      Action
                    </th>
                    <th className="pb-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">
                      Actor
                    </th>
                    <th className="pb-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-4 font-mono text-xs text-secondary">{a.action}</td>
                      <td className="py-2 pr-4 font-ui text-xs text-secondary">{a.actor ?? "System"}</td>
                      <td className="whitespace-nowrap py-2 font-mono text-xs text-tertiary">
                        {fmt.format(a.performedAt)}
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
