// Create a club. Clubs are free: creating, joining, and taking part are all part of the
// free social product (Plus gates the AI companion, never clubs). The form writes to
// /api/v1/clubs from the browser and navigates to the new club on success.
import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { getAuth } from "~/lib/auth.server";
import { cloudflareContext } from "~/context";
import type { Route } from "./+types/club-new";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login?redirect=/clubs/new");
  return null;
}

export function meta() {
  return [{ title: "New club | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function ClubNew() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || undefined,
      visibility: form.get("visibility") === "private" ? "private" : "public",
      memberApproval: form.get("memberApproval") === "on",
    };
    try {
      const res = await fetch("/api/v1/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        club?: { slug: string };
        error?: { code?: string; message?: string };
      } | null;
      if (res.ok && data?.club?.slug) {
        void navigate(`/clubs/${data.club.slug}`);
        return;
      }
      setError(data?.error?.message ?? `Could not create the club (${res.status}).`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <Container className="max-w-xl">
        <h1 className="font-display text-4xl">Start a club</h1>
        <p className="mt-2 font-body text-secondary">
          Pick a book, set the pace, and read together.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="name" className="block font-ui text-sm font-medium text-primary">
              Club name
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={120}
              className="mt-1.5 w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block font-ui text-sm font-medium text-primary">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={4000}
              className="mt-1.5 w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
            />
          </div>
          <div>
            <label htmlFor="visibility" className="block font-ui text-sm font-medium text-primary">
              Visibility
            </label>
            <select
              id="visibility"
              name="visibility"
              defaultValue="public"
              className="mt-1.5 w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
            >
              <option value="public">Public - anyone can find and join</option>
              <option value="private">Private - members only, join by link</option>
            </select>
          </div>
          <label className="flex items-center gap-2 font-ui text-sm text-secondary">
            <input type="checkbox" name="memberApproval" className="h-4 w-4" />
            Approve each member before they join
          </label>

          {error ? (
            <p
              className="rounded-md border border-danger/50 bg-danger-subtle px-3 py-2 font-ui text-sm text-danger-text"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-cover bg-brand-text px-5 py-2.5 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
          >
            {pending ? "Creating..." : "Create club"}
          </button>
        </form>
      </Container>
    </PageShell>
  );
}
