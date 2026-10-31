// Where the emailed sign-in link opens (site-runtime ./sign-in, CONFIRM_PATH). The link's GET
// only shows this page, so a mail scanner that opens every link spends nothing; the button's POST
// signs in through confirmSignInLink. A refused link comes back here with ?error= and the time it
// was mailed, so the page can tell a used link from an expired one (signInLinkProblem).
import {
  SIGN_IN_LINK_WORDS,
  confirmSignInLink,
  signInLinkProblem,
} from "@dustinedwards/site-runtime/sign-in";
import { Link } from "capsomer/react/link";
import { AuthShell, ConfirmButtonForm } from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { linkPageHeaders, redirectOrLimited } from "~/lib/link-confirm.server";
import type { Route } from "./+types/sign-in-confirm";

export function meta() {
  return [{ title: "Sign in to Foxing" }, { name: "robots", content: "noindex" }];
}

// The page's URL holds the token.
export const headers = linkPageHeaders;

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // Only a refused link asks whether this browser is signed in already.
  if (!url.searchParams.has("error")) return { problem: signInLinkProblem(url) };
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  return { problem: signInLinkProblem(url, { signedIn: Boolean(session?.user) }) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  // Better Auth's redirect (done, or back here with ?error=), or its per-IP limit.
  return redirectOrLimited(await confirmSignInLink(await getAuth(env), request));
}

export default function SignInConfirm({ loaderData, actionData }: Route.ComponentProps) {
  const { problem } = loaderData;

  if (problem) {
    const { title, text } = SIGN_IN_LINK_WORDS[problem];
    return (
      <AuthShell title={title} subtitle={text}>
        {problem === "signed-in" ? (
          <Link to="/me" className="cap-btn full" data-variant="primary" data-size="lg">
            Go to Foxing
          </Link>
        ) : (
          <Link to="/login" className="cap-btn full" data-variant="primary" data-size="lg">
            Get a new link
          </Link>
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

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
