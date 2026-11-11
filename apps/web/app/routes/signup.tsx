// Making an account: the same sign-in screen as /login (capsomer/react/sign-in) with its own
// title. A new account starts from Google, Apple or an emailed link, which makes the account on
// its first use and lands on onboarding by way of the passkey offer.
import { SignIn } from "capsomer/react/sign-in";
import { Link } from "capsomer/react/link";
import { Form, useNavigation } from "react-router";
import { AuthPage, authBrand } from "~/components/auth-brand";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { signInPageAction, signInPageData } from "~/lib/sign-in-page.server";
import { DEFAULT_NEXT } from "~/lib/sign-in-path";
import type { Route } from "./+types/signup";

export function meta() {
  return [{ title: "Create your Foxing account" }, { name: "robots", content: "noindex" }];
}

export function loader({ context, request }: Route.LoaderArgs) {
  return signInPageData(context.get(cloudflareContext).env, request);
}

export function action({ context, request }: Route.ActionArgs) {
  return signInPageAction(context.get(cloudflareContext).env, request);
}

export default function Signup({ loaderData, actionData }: Route.ComponentProps) {
  const { methods, next, error } = loaderData;
  const pending = useNavigation().state !== "idle";
  return (
    <AuthPage>
      <SignIn
        layout="screen"
        brand={authBrand}
        title="Create your account"
        lede="Track what you read and join the conversation."
        footer={
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
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
