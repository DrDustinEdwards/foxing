// Where both email-change links open (site-runtime ./sign-in, EMAIL_CONFIRM_PATH): the approval
// mailed to the current address and the confirmation mailed to the new one. Better Auth's own link
// acts on a GET, so a mail scanner that opens every link could approve and make the change; this
// page's GET only shows a button, and its POST runs the step through confirmEmailLink, which comes
// back here with ?done= or ?error= (emailLinkResult).
import {
  type EmailLinkProblem,
  confirmEmailLink,
  emailLinkResult,
} from "@dustinedwards/site-runtime/sign-in";
import { signalCurrentUserDetails } from "@dustinedwards/site-runtime/sign-in-client";
import { createDb, profilesRepo } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { useEffect } from "react";
import { AuthShell, ConfirmButtonForm } from "~/components/auth-shell";
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
  // The change is made, and this browser is signed in to the account: name its new address.
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

/** What a refused link says. Email change links are Better Auth's, good for an hour. */
const PROBLEM: Record<EmailLinkProblem, { title: string; text: string }> = {
  expired: {
    title: "This link has expired",
    text: "Email change links work for an hour. Ask for the change again in Settings.",
  },
  done: {
    title: "This change is already made",
    text: "The link has been used, so it no longer works. Your account email is shown in Settings.",
  },
  "other-account": {
    title: "This link is for another account",
    text: "This browser is signed in to a different Foxing account. Sign out, then open the link again.",
  },
  invalid: {
    title: "This link no longer works",
    text: "It is not complete or not valid. Open it from the email again, or ask for the change again in Settings.",
  },
  failed: {
    title: "The change did not finish",
    text: "Something went wrong on our side. Open the link from the email again, or ask for the change again in Settings.",
  },
  missing: {
    title: "This link is not complete",
    text: "Part of the link is missing. Open it straight from the email.",
  },
};

function SettingsLink() {
  return (
    <Link to="/settings" className="cap-btn full" data-variant="primary" data-size="lg">
      Go to Settings
    </Link>
  );
}

export default function EmailConfirm({ loaderData, actionData }: Route.ComponentProps) {
  const { done, problem, email, displayName } = loaderData;

  // The new address is the account's name now, so the password manager shows it on the passkeys.
  useEffect(() => {
    if (done === "changed" && email)
      void signalCurrentUserDetails({ name: email, displayName: displayName || undefined });
  }, [done, email, displayName]);

  if (problem) {
    const { title, text } = PROBLEM[problem];
    return (
      <AuthShell title={title} subtitle={text}>
        <SettingsLink />
      </AuthShell>
    );
  }

  if (done === "approved")
    return (
      <AuthShell
        title="Change approved"
        subtitle="Now open the link Foxing sent to your new address to finish the change."
      >
        <SettingsLink />
      </AuthShell>
    );

  if (done)
    return (
      <AuthShell
        title="Email changed"
        subtitle={
          email
            ? `Your Foxing account email is now ${email}.`
            : "Your Foxing account email is changed."
        }
      >
        <SettingsLink />
      </AuthShell>
    );

  return (
    <AuthShell
      title="Confirm your email change"
      subtitle="Nothing changes until you press the button."
    >
      <ConfirmButtonForm label="Confirm" limited={actionData?.limited} />
    </AuthShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle), for the signal after a change.
export const handle = { hydrate: true };
