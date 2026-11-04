// What the emailed links' confirm pages share (/sign-in/confirm and /email/confirm): their URL
// holds the token, and only their button's POST acts.
import { data } from "react-router";

/** The pages' headers: never stored, never indexed. */
export const linkPageHeaders = () => ({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });

/** The POST's answer: Better Auth's redirect as it is, or its per-IP limit as page data. */
export function redirectOrLimited(res: Response) {
  return res.status === 429 ? data({ limited: true }, { status: 429 }) : res;
}
