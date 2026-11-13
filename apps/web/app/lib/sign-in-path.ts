// Where Foxing's sign-in lives, in one place for every page that sends a reader there. The page
// a reader is sent from goes as `next`, which /login carries through every way in and checks
// again (safeNextPath).

/** The sign-in page. */
const SIGN_IN_PATH = "/login";

/** The sign-in page, returning to `next`. */
export function signInHref(next?: string | null) {
  return next ? `${SIGN_IN_PATH}?${new URLSearchParams({ next })}` : SIGN_IN_PATH;
}

/** The sign-in page, returning to the page this request asked for. */
export function signInFrom(request: Request) {
  const url = new URL(request.url);
  return signInHref(url.pathname + url.search);
}
