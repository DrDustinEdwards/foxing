import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/me";

export function meta() {
  return [{ title: "Your profile" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  // Signed-out to /login, signed-in-without-profile to /onboarding, else the profile.
  const { user, profile } = await requireProfile(env, request);
  return { email: user.email, profile };
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const { email, profile } = loaderData;
  return (
    <main>
      <h1>Your profile</h1>
      <p>{email}</p>
      <p>@{profile.username}</p>
      {profile.displayName ? <p>{profile.displayName}</p> : null}
    </main>
  );
}
