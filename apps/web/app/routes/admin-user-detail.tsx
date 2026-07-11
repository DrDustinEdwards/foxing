// Admin: User detail. Full profile for one reader with a suspend/unsuspend toggle.
// Read in-process via adminRepo; the toggle writes to /api/v1/admin/users/:id/suspend.
// Email is intentionally not surfaced (it is not on the profile row). isAdmin shows
// read-only; promoting/demoting admins is out of scope here.
import { adminRepo, createDb } from "@foxing/core";
import { Link, useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import { AdminButton, AdminError, useAdminAction } from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-user-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const user = await adminRepo.getUserDetail(createDb(env.DB), params.id);
  if (!user) throw new Response("Not found", { status: 404 });
  return { user };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `Admin · @${loaderData.user.username} | Foxing` : "Admin · User | Foxing" },
    { name: "robots", content: "noindex" },
  ];
}

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const fmtDateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">{label}</p>
      <p className="mt-0.5 font-ui text-sm text-primary">{children}</p>
    </div>
  );
}

export default function AdminUserDetail({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const revalidator = useRevalidator();
  const { pending, error, run } = useAdminAction({ onDone: () => revalidator.revalidate() });
  const genres = user.favoriteGenres?.length ? user.favoriteGenres.join(", ") : "None set";

  return (
    <AdminShell>
      <div className="mb-6">
        <Link to="/admin/users" className="font-ui text-sm text-secondary hover:text-brand-text">
          Back to users
        </Link>
        <h1 className="mt-2 font-display text-3xl text-primary">@{user.username}</h1>
      </div>

      <AdminCard
        title={user.displayName ?? "No name set"}
        action={
          <AdminButton
            variant={user.isSuspended ? "default" : "danger"}
            pending={pending}
            onClick={() =>
              run(
                `/users/${user.id}/suspend`,
                { body: { suspended: !user.isSuspended } },
                "Could not update",
              )
            }
          >
            {user.isSuspended ? "Unsuspend" : "Suspend"}
          </AdminButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bio">{user.bio ?? "No bio"}</Field>
          <Field label="Tier">{user.subscriptionTier === "plus" ? "Plus" : "Free"}</Field>
          <Field label="Status">{user.isSuspended ? "Suspended" : "Active"}</Field>
          <Field label="Subscription">{user.subscriptionStatus ?? "None"}</Field>
          <Field label="Admin">{user.isAdmin ? "Yes" : "No"}</Field>
          <Field label="Genres">{genres}</Field>
          <Field label="Timezone">{user.timezone ?? "Not set"}</Field>
          <Field label="Onboarded">
            {user.onboardedAt ? fmtDateTime.format(user.onboardedAt) : "Not onboarded"}
          </Field>
          <Field label="Joined">{fmtDate.format(user.createdAt)}</Field>
        </div>
        <AdminError error={error} />
      </AdminCard>
    </AdminShell>
  );
}
