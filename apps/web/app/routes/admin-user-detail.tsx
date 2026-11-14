// Admin: User detail. Full profile for one reader plus operator controls: suspend,
// change tier, send a notification, and delete the account. Reads run in-process via
// adminRepo; every write goes to /api/v1/admin/users/:id/* with an audit-log entry and a
// visible pending + role=alert error. Suspend and tier open a confirmation showing the
// server's preview before anything changes. Who is an admin is ADMIN_EMAIL and CO_OWNER_EMAILS alone.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { Link } from "capsomer/react/link";
import { mediumDate, mediumDateTime } from "~/lib/dates";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { useRoleChange } from "~/components/admin/confirm-change";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-user-detail";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  const db = createDb(env.DB);
  const user = await adminRepo.getUserDetail(db, params.id, env);
  if (!user) throw new Response("Not found", { status: 404 });
  const stats = await adminRepo.getUserActivityStats(db, params.id);
  return { user, stats };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return noindexMeta(
    loaderData ? `Admin · @${loaderData.user.username} | Foxing` : "Admin · User | Foxing",
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="fx-admin-user-detail-caps">{label}</p>
      <p className="fx-admin-user-detail-text">{children}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="cap-text cap-card fx-admin-user-detail-card" data-align="center">
      <p className="cap-title" data-size="3">
        {value}
      </p>
      <p className="fx-admin-user-detail-caps-2">{label}</p>
    </div>
  );
}

export default function AdminUserDetail({ loaderData }: Route.ComponentProps) {
  const { user, stats } = loaderData;
  const revalidator = useRevalidator();
  const suspend = useRoleChange({ onDone: () => void revalidator.revalidate() });
  const genres = user.favoriteGenres?.length ? user.favoriteGenres.join(", ") : "None set";

  return (
    <AdminShell>
      <div className="mb-6">
        <Link to="/admin/users" className="fx-admin-user-detail-link">
          Back to users
        </Link>
        <h1 className="mt-2 fx-admin-user-detail-title">@{user.username}</h1>
      </div>

      <AdminCard
        title={user.displayName ?? "No name set"}
        action={
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
        }
      >
        <div className="fx-admin-user-detail-grid">
          <Field label="Email">{user.email ?? "Unknown"}</Field>
          <Field label="Bio">{user.bio ?? "No bio"}</Field>
          <Field label="Tier">{user.subscriptionTier === "plus" ? "Plus" : "Free"}</Field>
          <Field label="Status">{user.isSuspended ? "Suspended" : "Active"}</Field>
          <Field label="Subscription">{user.subscriptionStatus ?? "None"}</Field>
          <Field label="Admin">{user.isAdmin ? "Yes" : "No"}</Field>
          <Field label="Genres">{genres}</Field>
          <Field label="Timezone">{user.timezone ?? "Not set"}</Field>
          <Field label="Onboarded">
            {user.onboardedAt ? mediumDateTime.format(user.onboardedAt) : "Not onboarded"}
          </Field>
          <Field label="Last active">
            {user.lastActiveAt ? mediumDateTime.format(user.lastActiveAt) : "Never"}
          </Field>
          <Field label="Joined">{mediumDate.format(user.createdAt)}</Field>
        </div>
        <AdminError error={suspend.error} />
        {suspend.dialog}
      </AdminCard>

      <div className="mt-6">
        <AdminCard title="Activity">
          <div className="fx-admin-user-detail-grid-2">
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
        />
      </div>
    </AdminShell>
  );
}

function OperatorControls({
  userId,
  username,
  isPlus,
}: {
  userId: string;
  username: string;
  isPlus: boolean;
}) {
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { pending, error, run } = useAdminAction({ onDone: () => void revalidator.revalidate() });
  const tier = useRoleChange({ onDone: () => void revalidator.revalidate() });
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
    if (result) void navigate("/admin/users");
  }

  return (
    <AdminCard title="Operator controls">
      <div className="cap-stack" data-gap="6">
        <div>
          <div className="fx-admin-user-detail-row">
            <AdminButton
              pending={tier.pending}
              onClick={() =>
                void tier.request(
                  `/users/${userId}/tier`,
                  { tier: isPlus ? "free" : "plus" },
                  isPlus ? "Downgrade to Free" : "Upgrade to Plus",
                )
              }
            >
              {isPlus ? "Downgrade to Free" : "Upgrade to Plus"}
            </AdminButton>
          </div>
          <AdminError error={tier.error} />
          {tier.dialog}
        </div>

        <div className="fx-admin-user-detail-box">
          <p
            className="cap-text"
            data-size="small"
            data-tone="ink"
            data-weight="strong"
            data-face="ui"
          >
            Send a notification
          </p>
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
          <div className="cap-cluster" data-gap="4">
            <AdminButton
              pending={pending}
              disabled={title.trim().length === 0}
              onClick={() => void sendNotification()}
            >
              Send to @{username}
            </AdminButton>
            {notifySent ? (
              <span
                className="cap-text"
                data-size="small"
                data-tone="dim"
                data-face="ui"
                role="status"
              >
                Sent.
              </span>
            ) : null}
          </div>
        </div>

        <div className="fx-admin-user-detail-box-2">
          <p className="fx-admin-user-detail-text-2">Delete account</p>
          <p className="cap-text" data-size="tiny" data-tone="muted" data-face="ui">
            Permanently erases this account and all of its data. Type{" "}
            <span className="cap-text" data-tone="ink" data-weight="strong">
              {username}
            </span>{" "}
            to confirm.
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
            onClick={() => void remove()}
          >
            Delete this account
          </AdminButton>
        </div>

        <AdminError error={error} />
      </div>
    </AdminCard>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
