// What the emailed links' confirm pages share (/sign-in/confirm and /email/confirm): their URL
// holds the token, and only their button's POST acts.
import { PRIVATE_PAGE_HEADERS } from "@dustinedwards/site-runtime/edge-cache";
import { data } from "react-router";

export const linkPageHeaders = () => ({ ...PRIVATE_PAGE_HEADERS, "X-Robots-Tag": "noindex" });

export function redirectOrLimited(res: Response) {
  return res.status === 429 ? data({ limited: true }, { status: 429 }) : res;
}
