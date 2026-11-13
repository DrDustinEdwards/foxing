// Admin: Users. Search by username/display name and suspend/unsuspend accounts.
// Read-only list in-process via adminRepo; the suspend toggle opens a confirmation with
// the server's preview, then writes to /api/v1/admin/users/:id/suspend with the token,
// with a visible error on failure.
import { adminRepo, createDb } from "@foxing/core";
import { useRevalidator } from "react-router";
import { ButtonLink } from "capsomer/react/link";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { AdminButton, AdminError, adminInputClass, AdminRow } from "~/components/admin/admin-form";
import { useRoleChange } from "~/components/admin/confirm-change";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-users";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const users = await adminRepo.listUsers(createDb(env.DB), { q: q || undefined, admins: env });
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
        <p className="group-label">Admin</p>
        <h1 className="cap-title" data-size="2">
          Users
        </h1>
      </div>

      <div className="cap-stack" data-gap="6">
        <AdminCard>
          <form method="get" className="cap-cluster" data-gap="3">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by username or name"
              className={adminInputClass}
            />
            <button type="submit" className="cap-btn shrink-0">
              Search
            </button>
          </form>
        </AdminCard>

        <AdminCard title="Readers">
          {users.length === 0 ? (
            <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
              {q ? "No readers match that search." : "No readers yet."}
            </p>
          ) : (
            <ul className="divided">
              {users.map((u) => (
                <UserRow key={u.id} user={u} onDone={() => void reload()} />
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
    <AdminRow
      title={
        <>
          @{user.username}
          <span className="badge badge-quiet ml-2">{user.tier === "plus" ? "Plus" : "Free"}</span>
          {user.isSuspended ? (
            <span className="ml-2 fx-admin-users-caps">Suspended</span>
          ) : (
            <span className="badge ml-2">Active</span>
          )}
        </>
      }
      meta={<>{user.displayName ?? "No name set"}</>}
      actions={
        <>
          <AdminButton
            variant={user.isSuspended ? "default" : "danger"}
            pending={suspend.pending}
            onClick={() =>
              void suspend.request(
                `/users/${user.id}/suspend`,
                { suspended: !user.isSuspended },
                user.isSuspended ? "Unsuspend" : "Suspend",
              )
            }
          >
            {user.isSuspended ? "Unsuspend" : "Suspend"}
          </AdminButton>
          <ButtonLink to={`/admin/users/${user.id}`}>View</ButtonLink>
        </>
      }
    >
      <AdminError error={suspend.error} />
      {suspend.dialog}
    </AdminRow>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
