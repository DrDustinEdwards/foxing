import { signInMethods } from "@dustinedwards/site-runtime/sign-in";
import {
  AuthDivider,
  AuthLink,
  AuthShell,
  MagicLinkForm,
  SocialButtons,
} from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import type { Route } from "./+types/signup";

export function meta() {
  return [{ title: "Create your Foxing account" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return { methods: signInMethods(env, { social: true }) };
}

// A new account starts from Google, Apple or an email link (which creates the account on its
// first use); a passkey is offered once the person is in, since there is none to sign in with yet.
export default function Signup({ loaderData }: Route.ComponentProps) {
  const { methods } = loaderData;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Track what you read and join the conversation."
      footer={
        <>
          Already have an account? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      <div className="stack">
        <SocialButtons methods={methods} />
        {methods.google || methods.apple ? <AuthDivider /> : null}
        <MagicLinkForm turnstileSiteKey={methods.turnstileSiteKey} />
      </div>
    </AuthShell>
  );
}
