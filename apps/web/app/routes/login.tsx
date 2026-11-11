// Signing in: Capsomer's one sign-in screen (capsomer/react/sign-in) on site-runtime's server side
// (app/lib/sign-in-page.server.ts). A passkey first, Google and Apple, then an emailed link with its
// code. `next` is the page the reader was sent from (app/lib/sign-in-path.ts); `reauth` asks a
// signed-in reader for a fresh sign-in before a change on Settings that needs one.
import { SignIn } from "capsomer/react/sign-in";
import { Link } from "capsomer/react/link";
import { Form, useNavigation } from "react-router";
import { AuthPage, authBrand } from "~/components/auth-brand";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { signInPageAction, signInPageData } from "~/lib/sign-in-page.server";
import { DEFAULT_NEXT } from "~/lib/sign-in-path";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in to Foxing" }, { name: "robots", content: "noindex" }];
}

export function loader({ context, request }: Route.LoaderArgs) {
  return signInPageData(context.get(cloudflareContext).env, request);
}

export function action({ context, request }: Route.ActionArgs) {
  return signInPageAction(context.get(cloudflareContext).env, request);
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const { methods, next, reauth, error } = loaderData;
  const pending = useNavigation().state !== "idle";
  return (
    <AuthPage>
      <SignIn
        layout="screen"
        brand={authBrand}
        title={reauth ? "Sign in again" : "Sign in"}
        lede={reauth ? "To go on, sign in again." : "Welcome back to Foxing."}
        footer={
          <p>
            New to Foxing? <Link to="/signup">Create an account</Link>
          </p>
        }
        client={authClient}
        methods={methods}
        state={actionData ?? null}
        error={error}
        passkeyLanding={next ?? DEFAULT_NEXT}
        next={next ?? undefined}
        pending={pending}
        Form={Form}
      />
    </AuthPage>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
