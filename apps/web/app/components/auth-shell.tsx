// Shared chrome for the signed-out auth screens (login, signup, the passkey offer).
// A centered, branded card on the ground: Foxing wordmark, a surface card, and a footer
// slot for the cross-links. Fields and buttons are Capsomer's cap-input and cap-btn, the
// same as settings and everywhere else. The fox emoji is allowed in auth chrome (Rule 9).
//
// The ways in are the family's one sign-in (site-runtime ./sign-in): a passkey first, Google
// and Apple, and an emailed link (with Turnstile once its keys are set). No passwords.
import { mountTurnstile } from "@dustinedwards/site-runtime/turnstile";
import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { signIn } from "~/lib/auth-client";

/** Which ways in the page offers: the loader's signInMethods(env, { social: true }). */
export type SignInMethods = { google: boolean; apple: boolean; turnstileSiteKey: string | null };

/** After an email link: offer a passkey (/passkey skips straight on once one exists). */
const AFTER_LINK = "/passkey?next=/me";
const AFTER_LINK_NEW = "/passkey?next=/onboarding";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="fx-auth-shell-grid">
      <div className="fx-auth-shell-box">
        <Link to="/" className="mb-8 justify-center fx-auth-shell-link">
          <span aria-hidden="true">🦊</span>
          <span>Foxing</span>
        </Link>
        <div className="fx-auth-shell-card">
          <h1 className="display-2">{title}</h1>
          {subtitle ? <p className="fx-auth-shell-text">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center fx-auth-shell-box-2">{footer}</div> : null}
      </div>
    </main>
  );
}

/** Labeled text input matching the settings form rows. */
function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block fx-auth-shell-label">{label}</span>
      <input className="cap-input fx-input-ground full" {...props} />
    </label>
  );
}

/** Inline brand link used in auth copy and footers. */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="fx-auth-shell-link-2">
      {children}
    </Link>
  );
}

/** Secondary full-width button, used for the provider and reveal actions. */
const authSecondaryButtonClass = "cap-btn full";

/** The four-color Google "G", inline per the no-icon-libraries rule. */
function GoogleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="fx-auth-shell-icon">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.582c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.582 9 3.582Z"
      />
    </svg>
  );
}

/**
 * "Continue with Google": a full-width OAuth redirect. A new user (no profile row) lands
 * on /onboarding, an existing one on /me; a failed handshake returns to /login with Better
 * Auth's ?error= code (SignInError reads it).
 */
function GoogleButton({ redirectTo = "/me" }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={authSecondaryButtonClass}
      data-size="lg"
      onClick={async () => {
        setPending(true);
        await signIn.social({
          provider: "google",
          callbackURL: redirectTo,
          newUserCallbackURL: "/onboarding",
          errorCallbackURL: "/login",
        });
        // The call redirects the whole page; reset only if it somehow returns.
        setPending(false);
      }}
    >
      <GoogleGlyph />
      Continue with Google
    </button>
  );
}

/** Apple's logo, inline per the no-icon-libraries rule, in the text color (Apple's guidelines
 *  allow a monochrome logo beside "Continue with Apple" on a plain button). */
function AppleGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 814 1000"
      className="fx-auth-shell-icon"
      fill="currentColor"
    >
      <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C44 791 0 668 0 551 0 364 122 264 241 264c64 0 117 42 157 42 38 0 98-45 171-45 28 0 128 3 194 80zM564 166c30-36 51-85 51-135 0-7-1-14-2-19-48 2-106 32-140 73-27 31-53 80-53 131 0 8 1 15 2 18 3 1 9 1 14 1 43 0 98-29 128-69z" />
    </svg>
  );
}

/** "Continue with Apple", the same redirect as Google's. */
function AppleButton({ redirectTo = "/me" }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={authSecondaryButtonClass}
      data-size="lg"
      onClick={async () => {
        setPending(true);
        await signIn.social({
          provider: "apple",
          callbackURL: redirectTo,
          newUserCallbackURL: "/onboarding",
          errorCallbackURL: "/login",
        });
        setPending(false);
      }}
    >
      <AppleGlyph />
      Continue with Apple
    </button>
  );
}

/**
 * "Sign in with a passkey", the main way in. The browser asks which saved passkey to use; a
 * person with none can cancel and use another way. Also offers saved passkeys in the email
 * field's suggestions (conditional mediation), so a returning reader can just tap one.
 */
export function PasskeyButton({ redirectTo = "/me" }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithPasskey(autoFill: boolean) {
    const res = await signIn.passkey({ autoFill });
    if (!res?.error) {
      window.location.assign(redirectTo);
      return;
    }
    // A canceled prompt is the person choosing another way, not a failure to show.
    if (!autoFill && !("code" in res.error && res.error.code === "AUTH_CANCELLED")) {
      setError("That passkey didn't work. Try again, or use another way below.");
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: once per page; the browser holds one pending autofill request
  useEffect(() => {
    if (typeof PublicKeyCredential === "undefined") return;
    void PublicKeyCredential.isConditionalMediationAvailable?.().then((ok) => {
      if (ok) void signInWithPasskey(true);
    });
  }, []);

  return (
    <div className="stack-3">
      <button
        type="button"
        disabled={pending}
        className="cap-btn full"
        data-variant="primary"
        data-size="lg"
        onClick={async () => {
          setPending(true);
          setError(null);
          await signInWithPasskey(false);
          setPending(false);
        }}
      >
        Sign in with a passkey
      </button>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Google and Apple, each when the site has its settings. */
export function SocialButtons({ methods }: { methods: SignInMethods }) {
  return (
    <>
      {methods.google ? <GoogleButton /> : null}
      {methods.apple ? <AppleButton /> : null}
    </>
  );
}

/** What Better Auth's ?error= code on /login means for the reader, or null for none. */
export function signInErrorMessage(code: string | null): string | null {
  if (!code) return null;
  // Accounts are joined only by a signed-in person (site-runtime ./sign-in), never by a
  // matching email at sign-in, so this is the one error with a way forward to explain.
  if (code === "account_not_linked") {
    return "That email already has a Foxing account. Sign in with an email link, then connect Google or Apple in Settings.";
  }
  return "That sign-in did not complete. Try again or use another way.";
}

/** "or" rule between the provider button and the email options. */
export function AuthDivider() {
  return (
    <div className="row" aria-hidden="true">
      <span className="fx-auth-shell-label-2" />
      <span className="fx-auth-shell-label-3">or</span>
      <span className="fx-auth-shell-label-2" />
    </div>
  );
}

/**
 * "Email me a sign-in link". Sends a magic link that both signs in existing users and
 * creates new ones (new users route to /onboarding), then offers a passkey. Enumeration-safe:
 * the same check-your-email state shows whether or not the address is registered. The email
 * field also offers saved passkeys (autocomplete "webauthn"). With Turnstile on, its widget
 * sits above the button and its token goes as Better Auth's x-captcha-response header.
 */
export function MagicLinkForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const widget = useRef<HTMLDivElement>(null);

  // A token is good for one request, so each attempt gets a fresh widget.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt re-mounts the widget for a fresh token
  useEffect(() => {
    if (!turnstileSiteKey || !widget.current) return;
    return mountTurnstile(widget.current, turnstileSiteKey);
  }, [turnstileSiteKey, attempt]);

  if (sent) {
    return (
      <p role="status" className="fx-auth-shell-text-2">
        Check your email for a sign-in link. It expires in 5 minutes.
      </p>
    );
  }

  return (
    <form
      className="stack-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setCheckFailed(false);
        const form = new FormData(event.currentTarget);
        const token = String(form.get("cf-turnstile-response") ?? "");
        const res = await signIn
          .magicLink(
            {
              email: String(form.get("email")),
              callbackURL: AFTER_LINK,
              newUserCallbackURL: AFTER_LINK_NEW,
            },
            turnstileSiteKey ? { headers: { "x-captcha-response": token } } : undefined,
          )
          .catch(() => null);
        setPending(false);
        // The bot check is the one refusal to show: everything else gets the same neutral
        // result, so the form never says whether an address has an account.
        const code = (res?.error as { code?: string } | undefined)?.code;
        if (code === "MISSING_RESPONSE" || code === "VERIFICATION_FAILED") {
          setCheckFailed(true);
          setAttempt((n) => n + 1);
          return;
        }
        setSent(true);
      }}
    >
      <Field label="Email" name="email" type="email" required autoComplete="email webauthn" />
      {turnstileSiteKey ? <div ref={widget} /> : null}
      {checkFailed ? (
        <p role="alert" className="error">
          Complete the check, then send the link again.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSecondaryButtonClass} data-size="lg">
        {pending ? "Sending..." : "Email me a sign-in link"}
      </button>
    </form>
  );
}
