// Where both email-change links open (site-runtime ./sign-in, EMAIL_CONFIRM_PATH): the approval
// mailed to the current address and the confirmation mailed to the new one. Better Auth's own link
// acts on a GET, so a mail scanner that opens every link could approve and make the change; this
// page's GET only shows a button, and its POST runs the step through confirmEmailLink, which comes
// back here with ?done= or ?error= (emailLinkResult).
import { confirmEmailLink, emailLinkResult } from "@dustinedwards/site-runtime/sign-in";
import { createDb, profilesRepo } from "@foxing/core";
import { EmailConfirm } from "capsomer/react/sign-in";
import { AuthPage, authBrand } from "~/components/auth-brand";
import { cloudflareContext } from "~/context";
import { getAuth, sessionLookup } from "~/lib/auth.server";
import { linkPageHeaders, redirectOrLimited } from "~/lib/link-confirm.server";
import type { Route } from "./+types/email-confirm";

export function meta() {
  return [{ title: "Confirm your email change | Foxing" }, { name: "robots", content: "noindex" }];
}

// The page's URL holds the token.
export const headers = linkPageHeaders;

export async function loader({ context, request }: Route.LoaderArgs) {
  const result = emailLinkResult(request.url);
  if (result.done !== "changed") return { ...result, email: null, displayName: null };
  // The change is made, and this browser is signed in to the account: name its new address, with
  // the reader's display name for the password manager.
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession(sessionLookup(request));
  if (!session?.user) return { ...result, email: null, displayName: null };
  const profile = await profilesRepo.getProfileById(createDb(env.DB), session.user.id);
  return { ...result, email: session.user.email, displayName: profile?.displayName ?? null };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  // Better Auth's redirect (done, or back here with ?error=), or its per-IP limit.
  return redirectOrLimited(await confirmEmailLink(await getAuth(env), request));
}

export default function EmailConfirmPage({ loaderData, actionData }: Route.ComponentProps) {
  const { done, problem, email, displayName } = loaderData;
  // With the new address, EmailConfirm names it and tells the password manager it is the
  // account's name now (the Signal API).
  return (
    <AuthPage>
      <EmailConfirm
        layout="screen"
        brand={authBrand}
        siteName="Foxing"
        settings="Settings"
        settingsPath="/settings"
        done={done}
        problem={problem}
        email={email}
        displayName={displayName}
        limited={actionData?.limited}
      />
    </AuthPage>
  );
}

// It hydrates (root.tsx, the `hydrate` handle), for EmailConfirm's signal after a change.
export const handle = { hydrate: true };
