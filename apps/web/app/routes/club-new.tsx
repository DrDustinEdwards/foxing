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
      <Container>
        <h1 className="display-4">Start a club</h1>
        <p className="mt-2 fx-club-new-text">Pick a book, set the pace, and read together.</p>

        <form onSubmit={onSubmit} className="mt-8 fx-club-new-form">
          <div>
            <label htmlFor="name" className="block fx-club-new-field">
              Club name
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={120}
              className="cap-input py-2 fx-club-new-input"
            />
          </div>
          <div>
            <label htmlFor="description" className="block fx-club-new-field">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={4000}
              className="cap-input py-2 fx-club-new-input"
            />
          </div>
          <div>
            <label htmlFor="visibility" className="block fx-club-new-field">
              Visibility
            </label>
            <select
              id="visibility"
              name="visibility"
              defaultValue="public"
              className="cap-select py-2 fx-club-new-input"
            >
              <option value="public">Public - anyone can find and join</option>
              <option value="private">Private - members only, join by link</option>
            </select>
          </div>
          <label className="row-2 ui">
            <input type="checkbox" name="memberApproval" className="fx-club-new-input-2" />
            Approve each member before they join
          </label>

          {error ? (
            <p className="py-2 fx-club-new-text-2" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className="cap-btn" data-variant="primary">
            {pending ? "Creating..." : "Create club"}
          </button>
        </form>
      </Container>
    </PageShell>
  );
}
