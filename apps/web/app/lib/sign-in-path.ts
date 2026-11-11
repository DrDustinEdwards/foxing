// Where Foxing's sign-in lives and where a sign-in lands, in one place for the pages that send a
// reader there (loaders, links, the account page) and for the sign-in pages themselves. The page
// a reader is sent from goes as `next`, which /login carries through every way in and checks
// again on the server (site-runtime's safeNextPath).

/** The sign-in page. */
export const SIGN_IN_PATH = "/login";

/** The flag that asks a signed-in reader to sign in again, before a change that needs a recent one. */
export const REAUTH_PARAM = "reauth";

/** Where a sign-in lands when it was not sent from a page. */
export const DEFAULT_NEXT = "/me";

/** The sign-in page, returning to `next`; `reauth` asks for a fresh sign-in. */
export function signInHref(next?: string | null, { reauth = false }: { reauth?: boolean } = {}) {
  const query = new URLSearchParams();
  if (next) query.set("next", next);
  if (reauth) query.set(REAUTH_PARAM, "1");
  const search = query.toString();
  return search ? `${SIGN_IN_PATH}?${search}` : SIGN_IN_PATH;
}

/** The sign-in page, returning to the page this request asked for. */
export function signInFrom(request: Request) {
  const url = new URL(request.url);
  return signInHref(url.pathname + url.search);
}

/** After an email link, a code, Google or Apple: the passkey offer, which goes on to `next` for
 *  someone it does not ask (one already made, a recent "Not now", or a device that cannot). */
export function afterSignIn(next: string) {
  return `/passkey?next=${encodeURIComponent(next)}`;
}

/** A new reader goes to onboarding, by the same offer. */
export const AFTER_NEW_ACCOUNT = afterSignIn("/onboarding");
