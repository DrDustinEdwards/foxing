import { signInMethods } from "@dustinedwards/site-runtime/sign-in";
import { useSearchParams } from "react-router";
import {
  AuthDivider,
  AuthLink,
  AuthShell,
  MagicLinkForm,
  PasskeyButton,
  SocialButtons,
  signInErrorMessage,
} from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in to Foxing" }, { name: "robots", content: "noindex" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return { methods: signInMethods(env, { social: true }) };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { methods } = loaderData;
  const [params] = useSearchParams();
  const error = signInErrorMessage(params.get("error"));

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Foxing."
      footer={
        <>
          New to Foxing? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      {error ? (
        <p role="alert" className="mb-4 fx-login-text-2">
          {error}
        </p>
      ) : null}

      <div className="stack">
        <PasskeyButton />
        <SocialButtons methods={methods} />
        <AuthDivider />
        <MagicLinkForm turnstileSiteKey={methods.turnstileSiteKey} />
      </div>
    </AuthShell>
  );
}
