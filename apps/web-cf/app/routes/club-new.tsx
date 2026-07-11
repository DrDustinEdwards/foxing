// Create a club (Plus-gated). Free users see the Plus paywall instead of the form;
// creating is the one Plus club action, joining/posting/polls stay free. The form
// writes to /api/v1/clubs from the browser and navigates to the new club on success.
// A 403 plus_required (tier changed mid-session) also opens the paywall.
import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/club-new";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login?redirect=/clubs/new");
  const { profile } = await requireProfileForUser(env, {
    id: session.user.id,
    email: session.user.email,
  });
  return { isPlus: profile.subscriptionTier === "plus" };
}

export function meta() {
  return [{ title: "New club | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function ClubNew({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [paywall, setPaywall] = useState(!loaderData.isPlus);
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
        navigate(`/clubs/${data.club.slug}`);
        return;
      }
      if (res.status === 403 && data?.error?.code === "plus_required") {
        setPaywall(true);
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
          Pick a book, set the pace, and read together. Creating a club is a Foxing Plus
          feature; joining and taking part is always free.
        </p>

        {!loaderData.isPlus ? (
          <div className="mt-8 rounded-card border border-border-subtle bg-surface p-8 text-center">
            <p className="font-ui text-sm text-secondary">
              Creating a club is part of Foxing Plus.
            </p>
            <button
              type="button"
              onClick={() => setPaywall(true)}
              className="mt-4 rounded-cover bg-brand-text px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover dark:text-[color:var(--section-charcoal)]"
            >
              See Foxing Plus
            </button>
          </div>
        ) : (
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
              <p className="rounded-md border border-danger/50 bg-danger-subtle px-3 py-2 font-ui text-sm text-danger-text" role="alert">
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
        )}
      </Container>
      <Paywall open={paywall} onClose={() => setPaywall(false)} />
    </PageShell>
  );
}
