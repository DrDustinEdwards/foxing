// Preview then perform for admin role and permission changes (grant or revoke admin,
// change tier, suspend or unsuspend). The first request to a role route changes
// nothing: the server answers with who gains or loses what and a single-use token. This
// dialog shows that preview and sends the token only when the operator confirms. It is
// a native modal <dialog>: focus moves into it, Tab stays inside, Escape cancels, and
// focus returns to the button that opened it.
import { useEffect, useId, useRef, useState } from "react";
import { AdminButton, adminFetch } from "./admin-form";

type RoleValue = boolean | string;

type RolePreview = {
  target: { id: string; username: string; displayName: string | null };
  kind: "admin" | "tier" | "suspend";
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

function errorMessage(body: unknown, status: number, fallback: string): string {
  const b = body as { error?: { message?: string } } | null;
  return b?.error?.message ?? `${fallback} (${status}).`;
}

const VALUE_LABELS: Record<RolePreview["kind"], (v: RoleValue) => string> = {
  admin: (v) => (v ? "Admin" : "Not admin"),
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
        setError(errorMessage(result.body, result.status, "Could not preview the change"));
        return;
      }
      const { preview, confirm } = result.body as PreviewResponse;
      setOpen({ path, body, label, preview, token: confirm.token, expiresAt: confirm.expiresAt });
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const summaryId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { preview } = change;
  const label = VALUE_LABELS[preview.kind];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  // Close while the element is still in the document, so the browser hands focus back
  // to the button that opened the dialog before React removes it.
  function closeThen(next: () => void) {
    ref.current?.close();
    next();
  }

  async function perform() {
    setPending(true);
    setError(null);
    try {
      const result = await adminFetch(change.path, {
        body: { ...change.body, confirm: change.token },
      });
      if (!result.ok) {
        setError(errorMessage(result.body, result.status, "Could not apply the change"));
        return;
      }
      closeThen(onDone);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) closeThen(onCancel);
      }}
      className="fx-confirm-dialog"
    >
      <h2 id={titleId} className="display-1">
        {change.label}?
      </h2>
      <p id={summaryId} className="mt-2 ui">
        {preview.summary}
      </p>
      <dl className="mt-4 fx-confirm-change-grid">
        <dt className="muted">Who</dt>
        <dd className="fx-confirm-change-value">
          @{preview.target.username}
          {preview.target.displayName ? ` (${preview.target.displayName})` : ""}
        </dd>
        <dt className="muted">Now</dt>
        <dd className="fx-confirm-change-value">{label(preview.from)}</dd>
        <dt className="muted">After</dt>
        <dd className="strong">{label(preview.to)}</dd>
      </dl>
      <p className="mt-4 fx-confirm-change-text">
        Nothing has changed yet. This confirmation works once, until{" "}
        {fmtTime.format(new Date(change.expiresAt))}. The change is recorded in the audit log under
        your account.
      </p>
      {error ? (
        <p className="mt-3 error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 justify-end fx-confirm-change-row">
        {/* Cancel is the first control, so showModal focuses it and Enter on open
            never performs the change. */}
        <AdminButton disabled={pending} onClick={() => closeThen(onCancel)}>
          Cancel
        </AdminButton>
        <AdminButton variant="danger" pending={pending} onClick={perform}>
          {change.label}
        </AdminButton>
      </div>
    </dialog>
  );
}
