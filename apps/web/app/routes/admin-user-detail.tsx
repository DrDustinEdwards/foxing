// Admin: User detail. Full profile for one reader plus operator controls: suspend,
// change tier, grant/revoke admin, send a notification, and delete the account. Reads
// run in-process via adminRepo; every write goes to /api/v1/admin/users/:id/* with an
// audit-log entry and a visible pending + role=alert error.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { Link, useNavigate, useRevalidator } from "react-router";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-user-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const user = await adminRepo.getUserDetail(db, params.id);
  if (!user) throw new Response("Not found", { status: 404 });
  const stats = await adminRepo.getUserActivityStats(db, params.id);
  return { user, stats };
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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-base p-3 text-center">
      <p className="font-display text-2xl text-primary">{value}</p>
      <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
        {label}
      </p>
    </div>
  );
}

export default function AdminUserDetail({ loaderData }: Route.ComponentProps) {
  const { user, stats } = loaderData;
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
          <Field label="Email">{user.email ?? "Unknown"}</Field>
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
          <Field label="Last active">
            {user.lastActiveAt ? fmtDateTime.format(user.lastActiveAt) : "Never"}
          </Field>
          <Field label="Joined">{fmtDate.format(user.createdAt)}</Field>
        </div>
        <AdminError error={error} />
      </AdminCard>

      <div className="mt-6">
        <AdminCard title="Activity">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Books read" value={stats.booksFinished} />
            <StatTile label="Highlights" value={stats.highlights} />
            <StatTile label="Clubs" value={stats.clubsJoined} />
            <StatTile label="Diary" value={stats.diaryEntries} />
          </div>
        </AdminCard>
      </div>

      <div className="mt-6">
        <OperatorControls
          userId={user.id}
          username={user.username}
          isPlus={user.subscriptionTier === "plus"}
          isAdmin={Boolean(user.isAdmin)}
        />
      </div>
    </AdminShell>
  );
}

function OperatorControls({
  userId,
  username,
  isPlus,
  isAdmin,
}: {
  userId: string;
  username: string;
  isPlus: boolean;
  isAdmin: boolean;
}) {
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { pending, error, run } = useAdminAction({ onDone: () => revalidator.revalidate() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notifySent, setNotifySent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  async function sendNotification() {
    setNotifySent(false);
    const result = await run(
      `/users/${userId}/notify`,
      { body: { title: title.trim(), body: body.trim() || null } },
      "Could not send",
    );
    if (result) {
      setTitle("");
      setBody("");
      setNotifySent(true);
    }
  }

  async function remove() {
    const result = await run(`/users/${userId}`, { method: "DELETE" }, "Could not delete");
    if (result) navigate("/admin/users");
  }

  return (
    <AdminCard title="Operator controls">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <AdminButton
            pending={pending}
            onClick={() =>
              run(`/users/${userId}/tier`, { body: { tier: isPlus ? "free" : "plus" } }, "Could not update")
            }
          >
            {isPlus ? "Downgrade to Free" : "Upgrade to Plus"}
          </AdminButton>
          <AdminButton
            pending={pending}
            onClick={() => run(`/users/${userId}/admin`, { body: { on: !isAdmin } }, "Could not update")}
          >
            {isAdmin ? "Revoke admin" : "Grant admin"}
          </AdminButton>
        </div>

        <div className="space-y-2 border-t border-border-subtle pt-5">
          <p className="font-ui text-sm font-medium text-primary">Send a notification</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={200}
            className={adminInputClass}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message (optional)"
            rows={2}
            maxLength={2000}
            className={adminInputClass}
          />
          <div className="flex items-center gap-3">
            <AdminButton pending={pending} disabled={title.trim().length === 0} onClick={sendNotification}>
              Send to @{username}
            </AdminButton>
            {notifySent ? (
              <span className="font-ui text-sm text-tertiary" role="status">
                Sent.
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-error/40 pt-5">
          <p className="font-ui text-sm font-medium text-error">Delete account</p>
          <p className="font-ui text-xs text-secondary">
            Permanently erases this account and all of its data. Type{" "}
            <span className="font-medium text-primary">{username}</span> to confirm.
          </p>
          <input
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder={username}
            aria-label={`Type ${username} to confirm deletion`}
            className={adminInputClass}
          />
          <AdminButton
            variant="danger"
            pending={pending}
            disabled={confirmDelete.trim() !== username}
            onClick={remove}
          >
            Delete this account
          </AdminButton>
        </div>

        <AdminError error={error} />
      </div>
    </AdminCard>
  );
}
