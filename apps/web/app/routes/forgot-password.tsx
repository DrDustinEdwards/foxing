import { useState } from "react";
import { Link } from "react-router";

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
      <main>
        <h1>Check your inbox</h1>
        <p>
          If that address is registered, we sent a reset link. Check your spam folder if you don't
          see it within a few minutes.
        </p>
        <p>
          <Link to="/login">Back to sign in</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Forgot your password?</h1>
      <p>Enter your email and we'll send a reset link.</p>
      <form onSubmit={onSubmit}>
        <p>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p>
        <Link to="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
