// The server side of /login and /signup, which are one sign-in screen (Capsomer's SignIn) with
// two titles: site-runtime's signInFormAction answers both pages' posts, the emailed link and
// the typed code, through Better Auth's handler, so its limiter and the Turnstile check run.
import { readForm } from "@dustinedwards/site-runtime/body";
import { CONFIRM_PATH, signInMethods } from "@dustinedwards/site-runtime/sign-in";
import {
  safeNextPath,
  signInErrorWords,
  signInFormAction,
} from "@dustinedwards/site-runtime/sign-in-form";
import { data, redirect } from "react-router";
import { getAuth } from "./auth.server";
import { AFTER_NEW_ACCOUNT, DEFAULT_NEXT, REAUTH_PARAM, afterSignIn } from "./sign-in-path";

/** The sign-in form is an address, a code, `next` and the Turnstile token. */
const FORM_LIMIT = 8 * 1024;

/** What both pages read from their address: the ways in, the page to return to, a fresh sign-in
 *  asked for, and the words for Better Auth's `?error=` (a refused Google or Apple sign-in). */
export function signInPageData(env: Env, request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("next");
  return {
    methods: signInMethods(env, { social: true }),
    // Carried only when given, so the plain page posts no `next`; the server falls back to /me.
    next: raw ? safeNextPath(raw, { fallback: DEFAULT_NEXT }) : null,
    reauth: params.has(REAUTH_PARAM),
    error: signInErrorWords(params.get("error"), { siteName: "Foxing", settings: "Settings" }),
  };
}

/** Both pages' action: a link or code sign-in lands on the passkey offer, then `next`. */
export async function signInPageAction(env: Env, request: Request) {
  const result = await signInFormAction(
    await getAuth(env),
    request,
    await readForm(request, FORM_LIMIT),
    {
      landing: afterSignIn,
      newUserLanding: () => AFTER_NEW_ACCOUNT,
      // A spent or expired link shows its own words on the confirm page.
      errorLanding: CONFIRM_PATH,
      next: { fallback: DEFAULT_NEXT },
    },
  );
  if ("location" in result) throw redirect(result.location, { headers: result.headers });
  return data(result.state, { status: result.status });
}
