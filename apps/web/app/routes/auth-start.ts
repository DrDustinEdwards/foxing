// Starts a Google or Apple sign-in (POST /auth/google, /auth/apple), the target of the sign-in
// screen's provider buttons: site-runtime's startSocialSignIn builds the provider's address and
// Better Auth's state cookie on the server, so the landing is decided here. A sign-in lands on the
// passkey offer, then `next`; a new reader on onboarding; a refused one back on /login, which says
// why (its ?error=).
import { readForm } from "@dustinedwards/site-runtime/body";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import { ipKey, limit, mustStop } from "@dustinedwards/site-runtime/rate-limit";
import { signInMethods } from "@dustinedwards/site-runtime/sign-in";
import { safeNextPath, startSocialSignIn } from "@dustinedwards/site-runtime/sign-in-form";
import { redirect } from "react-router";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import {
  AFTER_NEW_ACCOUNT,
  DEFAULT_NEXT,
  SIGN_IN_PATH,
  afterSignIn,
  signInHref,
} from "~/lib/sign-in-path";
import type { Route } from "./+types/auth-start";

/** The form is `next` alone. */
const FORM_LIMIT = 4 * 1024;

/** Ten starts a minute per address: the start writes Better Auth's state row, and a server call
 *  does not pass Better Auth's own per-IP limiter, which only its handler runs. */
const START_RULES = [{ limit: 10, windowSeconds: 60 }];

export async function action({ context, request, params }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const provider = params.provider;
  const methods = signInMethods(env, { social: true });
  if ((provider !== "google" && provider !== "apple") || !methods[provider])
    throw redirect(SIGN_IN_PATH);

  const verdict = await limit(env.RATE_LIMITER, ipKey("social-start", request).key, START_RULES, {
    onUnavailable: "allow",
  });
  if (mustStop(verdict, "allow")) {
    logEvent(
      OWASP_EVENTS.rateLimitExceeded,
      { ...requestFields(request), bucket: "social-start" },
      { level: "warn" },
    );
    throw redirect(`${SIGN_IN_PATH}?error=rate_limited`);
  }

  const form = await readForm(request, FORM_LIMIT);
  const next = safeNextPath(form.get("next"), { fallback: DEFAULT_NEXT });
  const started = await startSocialSignIn(await getAuth(env), request, {
    provider,
    callbackURL: afterSignIn(next),
    newUserCallbackURL: AFTER_NEW_ACCOUNT,
    errorCallbackURL: SIGN_IN_PATH,
  });
  if (!started) throw redirect(signInHref(next === DEFAULT_NEXT ? null : next));
  throw redirect(started.location, { headers: started.headers });
}

/** Only the form's post starts a sign-in. */
export function loader() {
  throw redirect(SIGN_IN_PATH);
}
