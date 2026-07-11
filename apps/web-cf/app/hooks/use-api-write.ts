// Generic browser write helper for Phase 6 social actions. Every write goes to /api/v1
// (the standing transport rule) and every failure surfaces a visible error string -- no
// silent swallow (see feedback: CF e2e must drive visible controls). Components render
// `error` in a role="alert" region. Mirrors use-club-write; kept generic so follow,
// diary, list, and reaction actions all share one seam.
import { useState } from "react";

type WriteResult = { ok: boolean; data: unknown };

export function useApiWrite() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function write(
    path: string,
    opts: { method?: string; body?: unknown } = {},
  ): Promise<WriteResult> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1${path}`, {
        method: opts.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(data?.error?.message ?? `Request failed (${res.status}).`);
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return { ok: false, data: null };
    } finally {
      setPending(false);
    }
  }

  return { write, error, pending, setError };
}
