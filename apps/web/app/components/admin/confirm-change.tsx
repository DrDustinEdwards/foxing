// Preview then perform for admin role and permission changes (change tier, suspend or
// unsuspend). The first request to a role route changes
// nothing: the server answers with who gains or loses what and a single-use token. This
// dialog shows that preview and sends the token only when the operator confirms. It is
// Capsomer's ConfirmDialog: focus starts on Cancel, Escape cancels except while the change
// runs, a failure stays inside it, and focus returns to the button that opened it.
import { useState } from "react";
import { ConfirmDialog } from "capsomer/react/confirm-dialog";
import { OFFLINE_MESSAGE } from "@foxing/client";
import { adminFetch, messageFrom } from "./admin-form";

type RoleValue = boolean | string;

type RolePreview = {
  target: { id: string; username: string; displayName: string | null };
  kind: "tier" | "suspend";
  from: RoleValue;
  to: RoleValue;
  summary: string;
};

type PreviewResponse = { preview: RolePreview; confirm: { token: string; expiresAt: string } };

type Open = {
  path: string;
  body: Record<string, unknown>;
  label: string;
  preview: RolePreview;
  token: string;
  expiresAt: string;
};

const VALUE_LABELS: Record<RolePreview["kind"], (v: RoleValue) => string> = {
  tier: (v) => (v === "plus" ? "Plus" : "Free"),
  suspend: (v) => (v ? "Suspended" : "Active"),
};

const fmtTime = new Intl.DateTimeFormat("en-US", { timeStyle: "short" });

/**
 * Drives one role change: `request` fetches the preview and opens the dialog; the
 * dialog's confirm button performs it with the token. Errors from the preview step
 * come back in `error` for the page to show beside the button; errors from the
 * perform step stay in the dialog.
 */
export function useRoleChange(opts: { onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Open | null>(null);

  async function request(path: string, body: Record<string, unknown>, label: string) {
    setPending(true);
    setError(null);
    try {
      const result = await adminFetch(path, { body });
      if (!result.ok) {
        setError(messageFrom(result, "Could not preview the change"));
        return;
      }
      const { preview, confirm } = result.body as PreviewResponse;
      setOpen({ path, body, label, preview, token: confirm.token, expiresAt: confirm.expiresAt });
    } catch {
      setError(OFFLINE_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  const dialog = open ? (
    <RoleChangeDialog
      change={open}
      onCancel={() => setOpen(null)}
      onDone={() => {
        setOpen(null);
        opts.onDone();
      }}
    />
  ) : null;

  return { pending, error, request, dialog };
}

function RoleChangeDialog({
  change,
  onCancel,
  onDone,
}: {
  change: Open;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { preview } = change;
  const label = VALUE_LABELS[preview.kind];
  const who = `@${preview.target.username}${preview.target.displayName ? ` (${preview.target.displayName})` : ""}`;

  async function perform() {
    const result = await adminFetch(change.path, {
      body: { ...change.body, confirm: change.token },
    }).catch(() => {
      throw new Error(OFFLINE_MESSAGE);
    });
    if (!result.ok) throw new Error(messageFrom(result, "Could not apply the change"));
  }

  return (
    <ConfirmDialog
      open
      title={`${change.label}?`}
      lead={`${preview.summary} Nothing has changed yet. This confirmation works once, until ${fmtTime.format(
        new Date(change.expiresAt),
      )}. The change is recorded in the audit log under your account.`}
      body={[`Who: ${who}`, `Now: ${label(preview.from)}`, `After: ${label(preview.to)}`]}
      action={change.label}
      perform={perform}
      onClose={(performed) => (performed ? onDone() : onCancel())}
    />
  );
}
