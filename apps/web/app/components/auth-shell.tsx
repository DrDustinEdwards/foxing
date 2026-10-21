// Shared chrome for the signed-out auth screens (login, signup, forgot/reset password).
// A centered, branded card on the base background: Foxing wordmark, a surface card with
// the same tokens as the rest of the app (rounded-card, border-border-subtle, bg-surface,
// shadow-card-md), and a footer slot for the cross-links. Fields and the submit button
// reuse the exact input + primary-button tokens from the design system so auth matches
// settings and everywhere else. The fox emoji is allowed in auth chrome (Rule 9).
import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { signIn } from "~/lib/auth-client";

/** Same input treatment as settings.tsx inputClass, plus a focus affordance. */
const authInputClass =
  "w-full rounded-md border border-border-subtle bg-base px-3 py-2.5 font-ui text-sm text-primary placeholder:text-tertiary transition-colors focus:border-border-interactive focus:outline-none";

/** Primary CTA: the same tokens as ui.tsx Button's primary variant, full width. */
const authButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-cover px-5 py-2.5 font-ui text-sm font-medium transition bg-brand-text text-on-brand hover:bg-brand-hover dark:text-[color:var(--section-charcoal)] disabled:opacity-60";

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
    <main className="grid min-h-[100dvh] place-items-center bg-base px-5 py-12">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-semibold text-primary"
        >
          <span aria-hidden="true">🦊</span>
          <span>Foxing</span>
        </Link>
        <div className="rounded-card border border-border-subtle bg-surface p-7 shadow-card-md">
          <h1 className="font-display text-2xl text-primary">{title}</h1>
          {subtitle ? <p className="mt-1.5 font-ui text-sm text-secondary">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="mt-5 text-center font-ui text-sm text-tertiary">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

/** Labelled text input matching the settings form rows. */
export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-ui text-sm font-medium text-secondary">{label}</span>
      <input className={authInputClass} {...props} />
    </label>
  );
}

/** Full-width primary submit with a pending state. */
export function AuthSubmit({ pending, children }: { pending?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className={authButtonClass}>
      {children}
    </button>
  );
}

/** Inline brand link used in auth copy and footers. */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-brand-text hover:underline">
      {children}
    </Link>
  );
}

/** Secondary full-width button: bordered surface, used for the provider and reveal actions. */
const authSecondaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-cover border border-border-subtle bg-surface px-5 py-2.5 font-ui text-sm font-medium text-primary transition hover:border-border-interactive hover:bg-sunken disabled:opacity-60";

/** The four-colour Google "G", inline per the no-icon-libraries rule. */
function GoogleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
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
 * on /onboarding, an existing one on /me; a failed handshake returns to the auth screen.
 */
export function GoogleButton({ redirectTo = "/me" }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={authSecondaryButtonClass}
      onClick={async () => {
        setPending(true);
        await signIn.social({
          provider: "google",
          callbackURL: redirectTo,
          newUserCallbackURL: "/onboarding",
          errorCallbackURL: "/login?error=oauth",
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

/** "or" rule between the provider button and the email options. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border-subtle" />
      <span className="font-ui text-xs uppercase tracking-wide text-tertiary">or</span>
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

/**
 * "Email me a sign-in link". Sends a magic link that both signs in existing users and
 * creates new ones (new users route to /onboarding). Enumeration-safe: the same
 * check-your-email state shows whether or not the address is registered.
 */
export function MagicLinkForm({ redirectTo = "/me" }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <p
        role="status"
        className="rounded-md border border-border-subtle bg-sunken px-3 py-2.5 font-ui text-sm text-secondary"
      >
        Check your email for a sign-in link. It expires in 10 minutes.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const email = String(new FormData(event.currentTarget).get("email"));
        // Show the same neutral result regardless of outcome.
        await signIn
          .magicLink({ email, callbackURL: redirectTo, newUserCallbackURL: "/onboarding" })
          .catch(() => {});
        setPending(false);
        setSent(true);
      }}
    >
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <button type="submit" disabled={pending} className={authSecondaryButtonClass}>
        {pending ? "Sending..." : "Email me a sign-in link"}
      </button>
    </form>
  );
}

/** Text toggle that reveals the collapsed password form. */
export function RevealLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onClick}
        className="font-ui text-sm font-medium text-brand-text hover:underline"
      >
        {children}
      </button>
    </div>
  );
}
