// After an email link: offer a passkey, so next time there is no email to wait for. Someone who
// already has one goes straight on. `next` is where they were headed (/me, or /onboarding for a
// new reader), a path on this site only.
import { useState } from "react";
import { redirect } from "react-router";
import { AuthLink, AuthShell } from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/passkey-offer";

export function meta() {
  return [{ title: "Add a passkey | Foxing" }, { name: "robots", content: "noindex" }];
}

/** Only a path on this site, never another origin (`//host` included). */
function nextPath(url: URL): string {
  const next = url.searchParams.get("next") ?? "/me";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/me";
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const next = nextPath(new URL(request.url));
  const auth = await getAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login");
  const passkeys = await auth.api.listPasskeys({ headers: request.headers });
  if (passkeys.length > 0) throw redirect(next);
  return { next };
}

export default function PasskeyOffer({ loaderData }: Route.ComponentProps) {
  const { next } = loaderData;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      title="You're signed in"
      subtitle="Next time, skip the email. A passkey signs you in with your face, fingerprint or device PIN, and only works on Foxing, so it cannot be phished."
    >
      <div className="stack">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="cap-btn full"
          data-variant="primary"
          data-size="lg"
          onClick={async () => {
            setPending(true);
            setError(null);
            const res = await authClient.passkey.addPasskey();
            setPending(false);
            if (res?.error) {
              setError("The passkey was not saved. Try again, or skip it for now.");
              return;
            }
            window.location.assign(next);
          }}
        >
          {pending ? "Waiting for your device..." : "Add a passkey"}
        </button>
        <p className="text-center fx-auth-shell-box-2">
          <AuthLink to={next}>Not now</AuthLink>
        </p>
      </div>
    </AuthShell>
  );
}
