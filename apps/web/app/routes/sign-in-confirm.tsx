import { confirmSignInLink } from "@dustinedwards/site-runtime/sign-in";
import { AuthShell } from "~/components/auth-shell";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/sign-in-confirm";

// Where an emailed sign-in link opens (site-runtime ./sign-in, CONFIRM_PATH): a GET signs nobody
// in, so a mail scanner that opens the link cannot spend it. The button posts back to this URL,
// query and all, and confirmSignInLink runs Better Auth's verify, answering its redirect and cookie.
export function meta() {
  return [{ title: "Sign in to Foxing" }, { name: "robots", content: "noindex" }];
}

export const headers = () => ({ "Cache-Control": "no-store" });

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  return confirmSignInLink(await getAuth(env), request);
}

export default function SignInConfirm() {
  return (
    <AuthShell title="Sign in" subtitle="Press the button to finish signing in on this device.">
      {/* A native post, so the page's own URL (the link's token) goes with it. */}
      <form method="post">
        <button type="submit" className="cap-btn full">
          Sign in to Foxing
        </button>
      </form>
    </AuthShell>
  );
}
