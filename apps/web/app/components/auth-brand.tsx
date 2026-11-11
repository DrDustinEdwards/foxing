// What Foxing puts around Capsomer's sign-in cards (capsomer/react/sign-in): the page's <main> on
// the ground, and the wordmark above the card. The fox emoji is allowed in auth chrome (Rule 9).
import { Link } from "capsomer/react/link";
import type { ReactNode } from "react";

export const authBrand = (
  <Link to="/" className="fx-auth-brand">
    <span aria-hidden="true">🦊</span>
    <span>Foxing</span>
  </Link>
);

/** The sign-in pages' <main>: no site navigation, the card centered (layout="screen"). */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="fx-auth-page">
      {children}
    </main>
  );
}
