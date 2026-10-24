// Shared write helpers for admin pages. Every mutation goes through the /api/v1/admin
// write surface from the browser (standing rule: writes are API calls, not loader
// subrequests) and surfaces a visible pending state + role=alert error on failure. No
// admin write may fail silently.
import { useState } from "react";

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

function messageFrom(result: Result, fallback: string): string {
  const b = result.body as { error?: { message?: string } } | null;
  return b?.error?.message ?? `${fallback} (${result.status}).`;
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
      setError("Could not reach the server. Check your connection and try again.");
      return null;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}

export function AdminError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-3 error" role="alert">
      {error}
    </p>
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
