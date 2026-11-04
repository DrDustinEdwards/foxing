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
import { safeNextPath } from "~/lib/auth-client";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in to Foxing" }, { name: "robots", content: "noindex" }];
}

// `next` is where to return after signing in again (signInAgainIfStale), else /me.
export function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const next = new URL(request.url).searchParams.get("next");
  return { methods: signInMethods(env, { social: true }), next: next ? safeNextPath(next) : null };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { methods, next } = loaderData;
  const [params] = useSearchParams();
  const error = signInErrorMessage(params.get("error"));

  return (
    <AuthShell
      title="Sign in"
      subtitle={next ? "Sign in again to go on." : "Welcome back to Foxing."}
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
        <PasskeyButton redirectTo={next ?? undefined} />
        <SocialButtons methods={methods} next={next ?? undefined} />
        <AuthDivider />
        <MagicLinkForm turnstileSiteKey={methods.turnstileSiteKey} next={next ?? undefined} />
      </div>
    </AuthShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
