// Admin: User detail. Full profile for one reader plus operator controls: suspend,
// change tier, grant/revoke admin, send a notification, and delete the account. Reads
// run in-process via adminRepo; every write goes to /api/v1/admin/users/:id/* with an
// audit-log entry and a visible pending + role=alert error. Suspend, tier and admin
// open a confirmation showing the server's preview before anything changes.
import { adminRepo, createDb } from "@foxing/core";
import { useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { Link } from "capsomer/react/link";
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
    {
      title: loaderData ? `Admin · @${loaderData.user.username} | Foxing` : "Admin · User | Foxing",
    },
    { name: "robots", content: "noindex" },
  ];
}

const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const fmtDateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

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
    <div className="text-center fx-admin-user-detail-card">
      <p className="display-2">{value}</p>
      <p className="fx-admin-user-detail-caps-2">{label}</p>
    </div>
  );
}

export default function AdminUserDetail({ loaderData }: Route.ComponentProps) {
  const { user, stats } = loaderData;
  const revalidator = useRevalidator();
  const suspend = useRoleChange({ onDone: () => revalidator.revalidate() });
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
              suspend.request(
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
            {user.onboardedAt ? fmtDateTime.format(user.onboardedAt) : "Not onboarded"}
          </Field>
          <Field label="Last active">
            {user.lastActiveAt ? fmtDateTime.format(user.lastActiveAt) : "Never"}
          </Field>
          <Field label="Joined">{fmtDate.format(user.createdAt)}</Field>
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
  const tier = useRoleChange({ onDone: () => revalidator.revalidate() });
  const admin = useRoleChange({ onDone: () => revalidator.revalidate() });
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
      <div className="stack-6">
        <div>
          <div className="fx-admin-user-detail-row">
            <AdminButton
              pending={tier.pending}
              onClick={() =>
                tier.request(
                  `/users/${userId}/tier`,
                  { tier: isPlus ? "free" : "plus" },
                  isPlus ? "Downgrade to Free" : "Upgrade to Plus",
                )
              }
            >
              {isPlus ? "Downgrade to Free" : "Upgrade to Plus"}
            </AdminButton>
            <AdminButton
              pending={admin.pending}
              onClick={() =>
                admin.request(
                  `/users/${userId}/admin`,
                  { on: !isAdmin },
                  isAdmin ? "Revoke admin" : "Grant admin",
                )
              }
            >
              {isAdmin ? "Revoke admin" : "Grant admin"}
            </AdminButton>
          </div>
          <AdminError error={tier.error ?? admin.error} />
          {tier.dialog}
          {admin.dialog}
        </div>

        <div className="fx-admin-user-detail-box">
          <p className="sans small strong">Send a notification</p>
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
          <div className="row">
            <AdminButton
              pending={pending}
              disabled={title.trim().length === 0}
              onClick={sendNotification}
            >
              Send to @{username}
            </AdminButton>
            {notifySent ? (
              <span className="meta" role="status">
                Sent.
              </span>
            ) : null}
          </div>
        </div>

        <div className="fx-admin-user-detail-box-2">
          <p className="fx-admin-user-detail-text-2">Delete account</p>
          <p className="sans xsmall muted">
            Permanently erases this account and all of its data. Type{" "}
            <span className="strong">{username}</span> to confirm.
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
