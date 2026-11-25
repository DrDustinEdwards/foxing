// Where the emailed sign-in link opens. The link's GET only shows this page, so a mail scanner that opens every link spends nothing; the button's POST signs in.
import { SIGN_IN_PATH } from "@dustinedwards/site-runtime/sign-in-path";
import {
  SIGN_IN_LINK_WORDS,
  confirmSignInLink,
  signInLinkProblem,
} from "@dustinedwards/site-runtime/sign-in";
import { ButtonLink } from "capsomer/react/link";
import { AuthShell, ConfirmButtonForm } from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import { getAuth, sessionUserFromRequest } from "~/lib/auth.server";
import { linkPageHeaders, redirectOrLimited } from "~/lib/link-confirm.server";
import type { Route } from "./+types/sign-in-confirm";
import { noindexPageMeta } from "~/lib/seo";

export function meta() {
  return noindexPageMeta("Sign in to Foxing");
}

export const headers = linkPageHeaders;

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  if (!url.searchParams.has("error")) return { problem: signInLinkProblem(url) };
  const { env } = context.get(cloudflareContext);
  const user = await sessionUserFromRequest(request, env);
  return { problem: signInLinkProblem(url, { signedIn: Boolean(user) }) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  return redirectOrLimited(await confirmSignInLink(await getAuth(env), request));
}

export default function SignInConfirm({ loaderData, actionData }: Route.ComponentProps) {
  const { problem } = loaderData;

  if (problem) {
    const { title, text } = SIGN_IN_LINK_WORDS[problem];
    return (
      <AuthShell title={title} subtitle={text}>
        {problem === "signed-in" ? (
          <ButtonLink to="/me" block variant="primary" size="lg">
            Go to Foxing
          </ButtonLink>
        ) : (
          <ButtonLink to={SIGN_IN_PATH} block variant="primary" size="lg">
            Get a new link
          </ButtonLink>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in to Foxing">
      <ConfirmButtonForm label="Sign in" limited={actionData?.limited} />
    </AuthShell>
  );
}

export const handle = { hydrate: true };
