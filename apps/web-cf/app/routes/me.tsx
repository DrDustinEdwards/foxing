import { Link, redirect } from "react-router";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/me";

type MeResponse = {
  user: { id: string; email: string };
  profile: Record<string, unknown> | null;
};

export function meta() {
  return [{ title: "Your profile" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login");

  // Full round trip web -> api -> core -> D1 (the Phase 1 gate).
  const res = await fetch(new URL("/api/v1/me", request.url), { headers: request.headers });
  const data = (await res.json()) as MeResponse;
  return { data };
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const { user, profile } = loaderData.data;
  return (
    <main>
      <h1>Your profile</h1>
      <p>{user.email}</p>
      {profile ? (
        <pre>{JSON.stringify(profile, null, 2)}</pre>
      ) : (
        <p>
          You have not onboarded yet. <Link to="/onboarding">Choose a username</Link>.
        </p>
      )}
    </main>
  );
}
