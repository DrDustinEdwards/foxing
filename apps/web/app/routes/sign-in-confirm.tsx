// Where the emailed sign-in link opens (site-runtime ./sign-in, CONFIRM_PATH). The link's GET
// only shows this page, so a mail scanner that opens every link spends nothing; the button's POST
// signs in through confirmSignInLink. A refused link comes back here with ?error= and the time it
// was mailed, so the page can tell a used link from an expired one (signInLinkProblem).
import { confirmSignInLink, signInLinkProblem } from "@dustinedwards/site-runtime/sign-in";
import { SignInConfirm } from "capsomer/react/sign-in";
import { AuthPage, authBrand } from "~/components/auth-brand";
import { cloudflareContext } from "~/context";
import { getAuth, sessionLookup } from "~/lib/auth.server";
import { linkPageHeaders, redirectOrLimited } from "~/lib/link-confirm.server";
import { DEFAULT_NEXT, SIGN_IN_PATH } from "~/lib/sign-in-path";
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
  const session = await (await getAuth(env)).api.getSession(sessionLookup(request));
  return { problem: signInLinkProblem(url, { signedIn: Boolean(session?.user) }) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  // Better Auth's redirect (done, or back here with ?error=), or its per-IP limit.
  return redirectOrLimited(await confirmSignInLink(await getAuth(env), request));
}

export default function SignInConfirmPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <AuthPage>
      <SignInConfirm
        layout="screen"
        brand={authBrand}
        siteName="Foxing"
        problem={loaderData.problem}
        limited={actionData?.limited}
        signInPath={SIGN_IN_PATH}
        continuePath={DEFAULT_NEXT}
      />
    </AuthPage>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
