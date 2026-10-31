// Shared chrome for the signed-out auth screens (login, signup, the passkey offer).
// A centered, branded card on the ground: Foxing wordmark, a surface card, and a footer
// slot for the cross-links. Fields and buttons are Capsomer's cap-input and cap-btn, the
// same as settings and everywhere else. The fox emoji is allowed in auth chrome (Rule 9).
//
// The ways in are the family's one sign-in (site-runtime ./sign-in): a passkey first, Google
// and Apple, and an emailed link (with Turnstile once its keys are set). No passwords.
import { CONFIRM_PATH, SIGN_IN_EXPIRES_IN_WORDS } from "@dustinedwards/site-runtime/sign-in";
import { mountTurnstile } from "@dustinedwards/site-runtime/turnstile";
import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "capsomer/react/link";
import { authClient, signIn } from "~/lib/auth-client";
import { signInWithPasskey, signalPasskeys } from "@dustinedwards/site-runtime/sign-in-client";

/** Which ways in the page offers: the loader's signInMethods(env, { social: true }). */
export type SignInMethods = { google: boolean; apple: boolean; turnstileSiteKey: string | null };

/** After an email link, code, Google or Apple: offer a passkey (/passkey skips straight on when
 *  there is one already or a recent "Not now"), then `next`. */
const afterLink = (next: string) => `/passkey?next=${encodeURIComponent(next)}`;
const AFTER_LINK_NEW = afterLink("/onboarding");

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
 * on /onboarding, an existing one on /me, each through the passkey offer; a failed handshake returns to /login with Better
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
          callbackURL: afterLink(redirectTo),
          newUserCallbackURL: AFTER_LINK_NEW,
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
          callbackURL: afterLink(redirectTo),
          newUserCallbackURL: AFTER_LINK_NEW,
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
 * After a passkey sign-in: tells the password manager which of the account's passkeys Foxing still
 * accepts (the Signal API). The names it shows are sent from Settings, where the display name is
 * known. Best effort, and never holds up the sign-in.
 */
async function signalAfterPasskeySignIn() {
  try {
    const { data } = await authClient.passkey.listUserPasskeys();
    if (data) await signalPasskeys({ credentialIds: data.map((p) => p.credentialID) });
  } catch {
    // The sign-in stands; the browser simply hears nothing this time.
  }
}

/**
 * "Sign in with a passkey", the main way in. The browser asks which saved passkey to use; a
 * person with none can cancel and use another way. Also offers saved passkeys in the email
 * field's suggestions (conditional mediation), so a returning reader can just tap one.
 */
export function PasskeyButton({ redirectTo = "/me" }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // site-runtime's signInWithPasskey: on a passkey this site no longer has, it tells the browser
  // to stop offering it (the Signal API).
  async function tryPasskey(autoFill: boolean) {
    const res = await signInWithPasskey(authClient, { autoFill });
    if (!res?.error) {
      await signalAfterPasskeySignIn();
      window.location.assign(redirectTo);
      return;
    }
    const code = (res.error as { code?: string }).code;
    // A canceled prompt is the person choosing another way, not a failure to show.
    if (autoFill || code === "AUTH_CANCELLED") return;
    setError(
      code === "RATE_LIMIT_UNAVAILABLE"
        ? "Sign-in is busy right now. Wait a minute and try again, or use the email link below."
        : code === "EMAIL_RATE_LIMITED" || code === "TOO_MANY_REQUESTS"
          ? "Too many tries. Wait a while, then try again, or use the email link below."
          : "That passkey didn't work. Try again, or use another way below.",
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: once per page; the browser holds one pending autofill request
  useEffect(() => {
    if (typeof PublicKeyCredential === "undefined") return;
    void PublicKeyCredential.isConditionalMediationAvailable?.().then((ok) => {
      if (ok) void tryPasskey(true);
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
          await tryPasskey(false);
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
export function SocialButtons({ methods, next }: { methods: SignInMethods; next?: string }) {
  return (
    <>
      {methods.google ? <GoogleButton redirectTo={next} /> : null}
      {methods.apple ? <AppleButton redirectTo={next} /> : null}
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
export function MagicLinkForm({
  turnstileSiteKey,
  next = "/me",
}: {
  turnstileSiteKey: string | null;
  next?: string;
}) {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const widget = useRef<HTMLDivElement>(null);

  // A token is good for one request, so each attempt gets a fresh widget.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt re-mounts the widget for a fresh token
  useEffect(() => {
    if (!turnstileSiteKey || !widget.current) return;
    return mountTurnstile(widget.current, turnstileSiteKey);
  }, [turnstileSiteKey, attempt]);

  if (sentTo)
    return <SignInCodeForm email={sentTo} next={next} onRestart={() => setSentTo(null)} />;

  return (
    <form
      className="stack-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setRefusal(null);
        const form = new FormData(event.currentTarget);
        const email = String(form.get("email"));
        const token = String(form.get("cf-turnstile-response") ?? "");
        const res = await signIn
          .magicLink(
            {
              email,
              callbackURL: afterLink(next),
              newUserCallbackURL: AFTER_LINK_NEW,
              // A spent or expired link shows its own message on the confirm page.
              errorCallbackURL: CONFIRM_PATH,
            },
            turnstileSiteKey ? { headers: { "x-captcha-response": token } } : undefined,
          )
          .catch(() => null);
        setPending(false);
        // The refusals to show are the ones about the site, never the address: the bot check, and
        // the link request turned off (no Turnstile keys) or its counter down. Everything else gets
        // the same neutral result, so the form never says whether an address has an account.
        const code = (res?.error as { code?: string } | undefined)?.code;
        if (code === "MISSING_RESPONSE" || code === "VERIFICATION_FAILED") {
          setRefusal("Complete the check, then send the link again.");
          setAttempt((n) => n + 1);
          return;
        }
        if (code === "TURNSTILE_NOT_SET" || code === "RATE_LIMIT_UNAVAILABLE") {
          setRefusal(
            "Sign-in by email is not available right now. Use a passkey, Google or Apple, or try again later.",
          );
          return;
        }
        setSentTo(email);
      }}
    >
      <Field label="Email" name="email" type="email" required autoComplete="username webauthn" />
      {turnstileSiteKey ? <div ref={widget} /> : null}
      {refusal ? (
        <p role="alert" className="error">
          {refusal}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSecondaryButtonClass} data-size="lg">
        {pending ? "Sending..." : "Email me a sign-in link"}
      </button>
    </form>
  );
}

/**
 * What a refused code means and what to do next, from Better Auth's email OTP error codes
 * (better-auth 1.7.12 plugins/email-otp/routes.mjs) and site-runtime's per-address limit.
 * INVALID_OTP is both a wrong code and one that is gone (used, or replaced by a newer email);
 * after three wrong tries the code is spent, which Better Auth says only on the fourth.
 */
function signInCodeError(code: string | undefined, wrongTries: number): string {
  if (code === "TOO_MANY_ATTEMPTS" || (code === "INVALID_OTP" && wrongTries >= 3))
    return "That code had three wrong tries, so it no longer works. Open the link in the same email, or send yourself a new one.";
  if (code === "INVALID_OTP")
    return "That code is not right. Check the six digits in the newest email from Foxing: a code from an older email, or one already used, does not work.";
  if (code === "OTP_EXPIRED")
    return `That code has expired: codes work for ${SIGN_IN_EXPIRES_IN_WORDS}. Send yourself a new one.`;
  if (code === "RATE_LIMIT_UNAVAILABLE")
    return "Codes cannot be checked right now. Open the link in the email, or try again in a minute.";
  if (code === "EMAIL_RATE_LIMITED" || code === "TOO_MANY_REQUESTS")
    return "Too many wrong codes for this address. Use the link in the email, or try again in an hour.";
  return "The code could not be checked. Check your connection and try again.";
}

/**
 * After the link is sent: the same mail carries a six-digit code, for when the link opens in
 * another browser (the mail app's, a phone). Typed here, it signs this tab in, a new address
 * included (it then lands on /onboarding through /me). Three wrong codes spend it; the link
 * still works. `onRestart` goes back to the email form for a new link and code.
 */
function SignInCodeForm({
  email,
  next,
  onRestart,
}: {
  email: string;
  next: string;
  onRestart: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [wrongTries, setWrongTries] = useState(0);
  return (
    <form
      className="stack-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setFailure(null);
        const otp = String(new FormData(event.currentTarget).get("code") ?? "").trim();
        const res = await signIn.emailOtp({ email, otp }).catch(() => null);
        if (res && !res.error) {
          window.location.assign(afterLink(next));
          return;
        }
        const code = (res?.error as { code?: string } | undefined)?.code;
        const tries = code === "INVALID_OTP" ? wrongTries + 1 : wrongTries;
        setWrongTries(tries);
        setPending(false);
        setFailure(signInCodeError(code, tries));
      }}
    >
      <p role="status" className="fx-auth-shell-text-2">
        Check your email. Open the sign-in link, or type the code from the same email here. Both
        work for {SIGN_IN_EXPIRES_IN_WORDS}.
      </p>
      <Field
        label="Code"
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
      />
      {failure ? (
        <p role="alert" className="error">
          {failure}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSecondaryButtonClass} data-size="lg">
        {pending ? "Signing in..." : "Sign in with the code"}
      </button>
      <button type="button" onClick={onRestart} className="cap-btn full" data-variant="ghost">
        Send a new link and code
      </button>
    </form>
  );
}
