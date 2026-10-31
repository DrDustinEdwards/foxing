// Where the emailed sign-in link opens (site-runtime ./sign-in, CONFIRM_PATH). The link's GET
// only shows this page, so a mail scanner that opens every link spends nothing; the button's POST
// signs in through confirmSignInLink. A spent or expired link comes back here with ?error=.
import { SIGN_IN_EXPIRES_IN_WORDS, confirmSignInLink } from "@dustinedwards/site-runtime/sign-in";
import { Link } from "capsomer/react/link";
import { data, useSearchParams } from "react-router";
import { AuthShell, signInErrorMessage } from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/sign-in-confirm";

export function meta() {
  return [{ title: "Sign in to Foxing" }, { name: "robots", content: "noindex" }];
}

// The page's URL holds the token.
export const headers = () => ({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const res = await confirmSignInLink(await getAuth(env), request);
  // Better Auth's redirect (signed in, or back here with ?error=), or its per-IP limit.
  if (res.status !== 429) return res;
  return data({ limited: true }, { status: 429 });
}

export default function SignInConfirm({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const error = params.get("error");

  if (error || !params.get("token")) {
    const spent = !error || error === "INVALID_TOKEN";
    return (
      <AuthShell
        title={spent ? "This link has expired" : "Sign-in did not complete"}
        subtitle={
          spent
            ? `A sign-in link works once, for ${SIGN_IN_EXPIRES_IN_WORDS}. Send yourself a new one.`
            : signInErrorMessage(error)
        }
      >
        <Link to="/login" className="cap-btn full" data-variant="primary" data-size="lg">
          Get a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in to Foxing">
      {/* A plain form: it posts to this URL, token and all, and the browser follows the redirect. */}
      <form method="post" className="stack-3">
        {actionData?.limited ? (
          <p role="alert" className="error">
            Too many tries. Wait a minute, then try again.
          </p>
        ) : null}
        <button type="submit" className="cap-btn full" data-variant="primary" data-size="lg">
          Sign in
        </button>
      </form>
    </AuthShell>
  );
}
