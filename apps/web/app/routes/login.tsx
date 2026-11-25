import { PRIVATE_PAGE_HEADERS } from "@dustinedwards/site-runtime/edge-cache";
import { signInMethods } from "@dustinedwards/site-runtime/sign-in";
import { safeNextPath } from "@dustinedwards/site-runtime/sign-in-form";
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
import { noindexPageMeta } from "~/lib/seo";

export const headers = () => PRIVATE_PAGE_HEADERS;

export function meta() {
  return noindexPageMeta("Sign in to Foxing");
}

export function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const next = new URL(request.url).searchParams.get("next");
  return {
    methods: signInMethods(env, { social: true }),
    next: next ? safeNextPath(next, { fallback: "/me" }) : null,
  };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { methods, next } = loaderData;
  const [params] = useSearchParams();
  const error = signInErrorMessage(params.get("error"));

  return (
    <AuthShell
      title="Sign in"
      subtitle={next ? "Sign in again to go on." : undefined}
      footer={
        <>
          New to Foxing? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      <div className="cap-stack" data-gap="5">
        {error ? (
          <p role="alert" className="fx-login-text-2">
            {error}
          </p>
        ) : null}
        <div className="cap-stack">
          <PasskeyButton redirectTo={next ?? undefined} />
          <SocialButtons methods={methods} next={next ?? undefined} />
          <AuthDivider />
          <MagicLinkForm turnstileSiteKey={methods.turnstileSiteKey} next={next ?? undefined} />
        </div>
      </div>
    </AuthShell>
  );
}

export const handle = { hydrate: true };
