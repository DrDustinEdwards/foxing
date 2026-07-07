import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import { createDb, profilesRepo } from "@foxing/core";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/onboarding";

export function meta() {
  return [{ title: "Choose your username" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login");
  const existing = await profilesRepo.getProfileById(createDb(env.DB), session.user.id);
  if (existing) throw redirect("/me");
  return { suggested: session.user.name ?? "" };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/v1/me/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: String(form.get("username")) }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not finish onboarding.");
      return;
    }
    navigate("/me");
  }

  return (
    <main>
      <h1>Choose your username</h1>
      <form onSubmit={onSubmit}>
        <p>
          <label>
            Username
            <input
              name="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
            />
          </label>
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Finish"}
        </button>
      </form>
    </main>
  );
}
