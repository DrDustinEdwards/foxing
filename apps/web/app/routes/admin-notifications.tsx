// Admin: Notifications. Broadcast a single in-app notification to every active reader.
// This hits all users, so the form requires a typed confirm before it fires. Reads
// nothing; writes to /api/v1/admin/notifications/broadcast with a visible success line
// and a visible error on failure.
import { useState } from "react";
import { AdminCard, AdminShell } from "~/components/admin/admin-shell";
import {
  AdminButton,
  AdminError,
  adminInputClass,
  useAdminAction,
} from "~/components/admin/admin-form";
import { cloudflareContext } from "~/context";
import { requireAdmin } from "~/lib/admin.server";
import type { Route } from "./+types/admin-notifications";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireAdmin(env, request);
  return {};
}

export function meta() {
  return [{ title: "Admin · Notifications | Foxing" }, { name: "robots", content: "noindex" }];
}

const CONFIRM_WORD = "BROADCAST";

export default function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const { pending, error, setError, run } = useAdminAction();

  async function send() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give the broadcast a title.");
      return;
    }
    if (confirm.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Type ${CONFIRM_WORD} to confirm you want to notify every reader.`);
      return;
    }
    setSent(null);
    const result = await run(
      "/notifications/broadcast",
      { body: { title: cleanTitle, body: body.trim() || undefined } },
      "Could not send the broadcast",
    );
    if (result) {
      const recipients = (result.body as { recipients?: number } | null)?.recipients ?? 0;
      setSent(recipients);
      setTitle("");
      setBody("");
      setConfirm("");
    }
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">Admin</p>
        <h1 className="font-display text-3xl text-primary">Notifications</h1>
      </div>

      <AdminCard title="Broadcast">
        <div className="space-y-4">
          <p className="rounded-md border border-border-subtle bg-sunken p-3 font-ui text-sm text-secondary">
            This sends one in-app notification to every active reader. It cannot be recalled.
            Confirm the text below before you send.
          </p>
          <label className="block">
            <span className="mb-1 block font-ui text-sm text-secondary">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={adminInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-ui text-sm text-secondary">Body (optional)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className={adminInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-ui text-sm text-secondary">
              Type {CONFIRM_WORD} to confirm
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={adminInputClass}
            />
          </label>
          <AdminButton variant="primary" pending={pending} onClick={send}>
            {pending ? "Sending..." : "Send broadcast"}
          </AdminButton>
          {sent !== null ? (
            <p className="font-ui text-sm text-brand-subtle-text" role="status">
              Sent to {sent} readers.
            </p>
          ) : null}
          <AdminError error={error} />
        </div>
      </AdminCard>
    </AdminShell>
  );
}
