import { useCallback, useState } from "react";

// The single browser write seam for the reader. Every personal-feature write goes to
// /api/v1 (the standing transport rule) and surfaces its own failure; nothing is
// swallowed. apiWrite returns the Response on success, null on failure (with
// writeError already set).
export function useApiWrite() {
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const apiWrite = useCallback(
    async (path: string, opts: { method: string; body?: unknown }): Promise<Response | null> => {
      setSaving(true);
      setWriteError(null);
      try {
        const res = await fetch(`/api/v1${path}`, {
          method: opts.method,
          headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          setWriteError(data?.error?.message ?? `Could not save (${res.status}). Try again.`);
          return null;
        }
        return res;
      } catch {
        setWriteError("Could not reach the server. Check your connection and try again.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { apiWrite, saving, writeError, setWriteError };
}
