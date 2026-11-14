// Shared write helpers for admin pages. Every mutation goes through the /api/v1/admin
// write surface from the browser (standing rule: writes are API calls, not loader
// subrequests) and surfaces a visible pending state + role=alert error on failure. No
// admin write may fail silently.
import { OFFLINE_MESSAGE } from "@foxing/client";
import { useState } from "react";
import { FormError } from "~/components/ui";

type Result = { ok: boolean; status: number; body: unknown };

/** POST/PATCH/DELETE against /api/v1/admin<path>, returning a parsed result. */
export async function adminFetch(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Result> {
  const res = await fetch(`/api/v1/admin${path}`, {
    method: init?.method ?? "POST",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

/** The server's problem detail, else "<fallback> (<status>)." */
export function messageFrom(result: Result, fallback: string): string {
  const b = result.body as { detail?: string } | null;
  return b?.detail ?? `${fallback} (${result.status}).`;
}

/** Drives one admin mutation: pending flag, visible error, and an onDone callback.
 *  Reloads the route on success by default so the list reflects the write. */
export function useAdminAction(opts?: { onDone?: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    path: string,
    init: { method?: string; body?: unknown } | undefined,
    fallback: string,
  ): Promise<Result | null> {
    setPending(true);
    setError(null);
    try {
      const result = await adminFetch(path, init);
      if (!result.ok) {
        setError(messageFrom(result, fallback));
        return null;
      }
      opts?.onDone?.();
      return result;
    } catch {
      setError(OFFLINE_MESSAGE);
      return null;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}

export function AdminError({ error }: { error: string | null }) {
  return <FormError error={error} className="mt-3" />;
}

// A labelled text field: a textarea when it has rows, else an input.
export function AdminField({
  label,
  onChange,
  rows,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="fx-label">{label}</span>
      {rows ? (
        <textarea
          {...props}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={adminInputClass}
        />
      ) : (
        <input {...props} onChange={(e) => onChange(e.target.value)} className={adminInputClass} />
      )}
    </label>
  );
}

// One row of an admin list: the item's name with its badges, one line of detail under it, and
// its actions at the end; an editor or a confirmation the row opens goes in children.
export function AdminRow({
  title,
  meta,
  metaSize = "small",
  actions,
  children,
}: {
  title: React.ReactNode;
  meta: React.ReactNode;
  metaSize?: "small" | "tiny";
  actions: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="py-3">
      <div className="cap-spread" data-gap="4" data-align="center">
        <div className="cap-shrink">
          <p
            className="cap-text"
            data-size="small"
            data-tone="ink"
            data-weight="strong"
            data-face="ui"
          >
            {title}
          </p>
          <p
            className="cap-text cap-clamp"
            data-size={metaSize}
            data-tone="dim"
            data-face="ui"
            data-lines="1"
          >
            {meta}
          </p>
        </div>
        <div className="cap-cluster cap-keep" data-gap="3">
          {actions}
        </div>
      </div>
      {children}
    </li>
  );
}

export const adminInputClass = "cap-input fx-input-ground";

export function AdminButton({
  children,
  pending,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={pending || props.disabled}
      className="cap-btn"
      data-variant={variant === "default" ? undefined : variant}
      {...props}
    >
      {children}
    </button>
  );
}
