import { SIGN_IN_PATH } from "@dustinedwards/site-runtime/sign-in-path";

export function signInHref(next?: string | null) {
  return next ? `${SIGN_IN_PATH}?${new URLSearchParams({ next })}` : SIGN_IN_PATH;
}

export function signInFrom(request: Request) {
  const url = new URL(request.url);
  return signInHref(url.pathname + url.search);
}
