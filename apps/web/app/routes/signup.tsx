import { SIGN_IN_PATH } from "@dustinedwards/site-runtime/sign-in-path";
import { PRIVATE_PAGE_HEADERS } from "@dustinedwards/site-runtime/edge-cache";
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
import { noindexMeta } from "~/lib/seo";

export const headers = () => PRIVATE_PAGE_HEADERS;

export function meta() {
  return noindexMeta("Create your Foxing account");
}

export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return { methods: signInMethods(env, { social: true }) };
}

export default function Signup({ loaderData }: Route.ComponentProps) {
  const { methods } = loaderData;
  return (
    <AuthShell
      title="Create your account"
      footer={
        <>
          Already have an account? <AuthLink to={SIGN_IN_PATH}>Sign in</AuthLink>
        </>
      }
    >
      <div className="cap-stack">
        <SocialButtons methods={methods} />
        {methods.google || methods.apple ? <AuthDivider /> : null}
        <MagicLinkForm turnstileSiteKey={methods.turnstileSiteKey} />
      </div>
    </AuthShell>
  );
}

export const handle = { hydrate: true };
