import { useState } from "react";
import { AuthLink, AuthShell, AuthSubmit, Field } from "~/components/auth-shell";

export function meta() {
  return [{ title: "Forgot password - Foxing" }];
}

export default function ForgotPassword() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    // Always show the same neutral response regardless of outcome so callers
    // cannot determine whether an email is registered.
    await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")),
        redirectTo: "/reset-password",
      }),
    }).catch(() => {});
    setPending(false);
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="If that address is registered, we sent a reset link. Check your spam folder if you don't see it within a few minutes."
        footer={<AuthLink to="/login">Back to sign in</AuthLink>}
      >
        <p className="ui">The link expires shortly, so open it soon.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send a reset link."
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      <form onSubmit={onSubmit} className="stack">
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <AuthSubmit pending={pending}>{pending ? "Sending..." : "Send reset link"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
