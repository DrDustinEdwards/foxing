// After an email link, code, Google or Apple: offer a passkey, so next time there is no email to
// wait for. Someone who already has one, said "Not now" in the last 30 days, or is on a device
// that cannot make one goes straight on (site-runtime shouldOfferPasskey, canOfferPasskey). `next`
// is where they were headed (/me, or /onboarding for a new reader), a path on this site only.
import { dismissPasskeyOffer, shouldOfferPasskey } from "@dustinedwards/site-runtime/sign-in";
import { safeNextPath } from "@dustinedwards/site-runtime/sign-in-form";
import { PasskeyOffer } from "capsomer/react/sign-in-settings";
import { Form, redirect } from "react-router";
import { AuthPage, authBrand } from "~/components/auth-brand";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { getAuth, sessionLookup } from "~/lib/auth.server";
import { DEFAULT_NEXT, SIGN_IN_PATH } from "~/lib/sign-in-path";
import type { Route } from "./+types/passkey-offer";

export function meta() {
  return [{ title: "Create a passkey | Foxing" }, { name: "robots", content: "noindex" }];
}

/** The signed-in reader, their auth and where they were headed; no session goes to /login. */
async function signedIn({ context, request }: Route.LoaderArgs | Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const next = safeNextPath(new URL(request.url).searchParams.get("next"), {
    fallback: DEFAULT_NEXT,
  });
  const auth = await getAuth(env);
  const session = await auth.api.getSession(sessionLookup(request));
  if (!session?.user) throw redirect(SIGN_IN_PATH);
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

export default function PasskeyOfferPage({ loaderData }: Route.ComponentProps) {
  return (
    <AuthPage>
      <PasskeyOffer
        layout="screen"
        brand={authBrand}
        client={authClient}
        next={loaderData.next}
        siteName="Foxing"
        Form={Form}
      />
    </AuthPage>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
