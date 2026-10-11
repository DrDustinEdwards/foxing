// Admin: Users. Search by username/display name and suspend/unsuspend accounts.
// Read-only list in-process via adminRepo; the suspend toggle opens a confirmation with
// the server's preview, then writes to /api/v1/admin/users/:id/suspend with the token,
// with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { Link, useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { AdminButton, AdminError, adminInputClass } from "~/components/admin/admin-form";
import { useRoleChange } from "~/components/admin/confirm-change";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-users";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const users = await adminRepo.listUsers(createDb(env.DB), { q: q || undefined });
  return { q, users };
}

export function meta() {
  return [{ title: "Admin · Users | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const { q, users } = loaderData;
  const revalidator = useRevalidator();
  const reload = () => revalidator.revalidate();

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Users</h1>
      </div>

      <div className="space-y-6">
        <AdminCard>
          <form method="get" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by username or name"
              className={adminInputClass}
            />
            <button
              type="submit"
              className="shrink-0 rounded-md border border-border-interactive px-4 py-2 font-ui text-sm transition hover:bg-hover"
            >
              Search
            </button>
          </form>
        </AdminCard>

        <AdminCard title="Readers">
          {users.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">
              {q ? "No readers match that search." : "No readers yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {users.map((u) => (
                <UserRow key={u.id} user={u} onDone={reload} />
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

function UserRow({
  user,
  onDone,
}: {
  user: Route.ComponentProps["loaderData"]["users"][number];
  onDone: () => void;
}) {
  const suspend = useRoleChange({ onDone });

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium text-primary">
            @{user.username}
            <span className="ml-2 rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-tertiary">
              {user.tier === "plus" ? "Plus" : "Free"}
            </span>
            {user.isSuspended ? (
              <span className="ml-2 rounded-full border border-error px-2 py-0.5 font-mono text-[0.6rem] uppercase text-error">
                Suspended
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-brand-subtle px-2 py-0.5 font-mono text-[0.6rem] uppercase text-brand-subtle-text">
                Active
              </span>
            )}
          </p>
          <p className="truncate font-ui text-sm text-tertiary">
            {user.displayName ?? "No name set"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <AdminButton
            variant={user.isSuspended ? "default" : "danger"}
            pending={suspend.pending}
            onClick={() =>
              suspend.request(
                `/users/${user.id}/suspend`,
                { suspended: !user.isSuspended },
                user.isSuspended ? "Unsuspend" : "Suspend",
              )
            }
          >
            {user.isSuspended ? "Unsuspend" : "Suspend"}
          </AdminButton>
          <Link
            to={`/admin/users/${user.id}`}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm transition hover:bg-hover"
          >
            View
          </Link>
        </div>
      </div>
      <AdminError error={suspend.error} />
      {suspend.dialog}
    </li>
  );
}
