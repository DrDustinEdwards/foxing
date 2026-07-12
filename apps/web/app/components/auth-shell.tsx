// Shared chrome for the signed-out auth screens (login, signup, forgot/reset password).
// A centered, branded card on the base background: Foxing wordmark, a surface card with
// the same tokens as the rest of the app (rounded-card, border-border-subtle, bg-surface,
// shadow-card-md), and a footer slot for the cross-links. Fields and the submit button
// reuse the exact input + primary-button tokens from the design system so auth matches
// settings and everywhere else. The fox emoji is allowed in auth chrome (Rule 9).
import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";

/** Same input treatment as settings.tsx inputClass, plus a focus affordance. */
export const authInputClass =
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
