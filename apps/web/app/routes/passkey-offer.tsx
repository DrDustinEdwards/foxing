// After an email link, code, Google or Apple: offer a passkey, so next time there is no email to
// wait for. Someone who already has one, said "Not now" in the last 30 days, or is on a device
// that cannot make one goes straight on (site-runtime shouldOfferPasskey, canOfferPasskey). `next`
// is where they were headed (/me, or /onboarding for a new reader), a path on this site only.
import { dismissPasskeyOffer, shouldOfferPasskey } from "@dustinedwards/site-runtime/sign-in";
import { canOfferPasskey } from "@dustinedwards/site-runtime/sign-in-client";
import { useEffect, useState } from "react";
import { Form, redirect } from "react-router";
import { AuthShell } from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import { authClient, safeNextPath, signInAgainIfStale } from "~/lib/auth-client";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/passkey-offer";

export function meta() {
  return [{ title: "Create a passkey | Foxing" }, { name: "robots", content: "noindex" }];
}

/** The signed-in reader, their auth and where they were headed; no session goes to /login. */
async function signedIn({ context, request }: Route.LoaderArgs | Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const auth = await getAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect("/login");
  return { env, auth, next, userId: session.user.id };
}

export async function loader(args: Route.LoaderArgs) {
  const { env, auth, next, userId } = await signedIn(args);
  const passkeys = await auth.api.listPasskeys({ headers: args.request.headers });
  if (!(await shouldOfferPasskey(env.DB, userId, passkeys))) throw redirect(next);
  return { next };
}

// "Not now": held for 30 days, for the person rather than this browser.
export async function action(args: Route.ActionArgs) {
  const { env, next, userId } = await signedIn(args);
  await dismissPasskeyOffer(env.DB, userId, { request: args.request });
  throw redirect(next);
}

export default function PasskeyOffer({ loaderData }: Route.ComponentProps) {
  const { next } = loaderData;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A device with no built-in way to make a passkey skips the offer.
  useEffect(() => {
    void canOfferPasskey().then((can) => {
      if (!can) window.location.replace(next);
    });
  }, [next]);

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
            if (signInAgainIfStale(res?.error)) return;
            setPending(false);
            if (res?.error) {
              setError("The passkey was not saved. Try again, or skip it for now.");
              return;
            }
            window.location.assign(next);
          }}
        >
          {pending ? "Waiting for your device..." : "Create a passkey"}
        </button>
        <Form method="post" className="text-center fx-auth-shell-box-2">
          <button type="submit" className="cap-btn" data-variant="ghost" disabled={pending}>
            Not now
          </button>
        </Form>
      </div>
    </AuthShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
