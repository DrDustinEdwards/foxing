import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClient } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Reset password - Foxing" }];
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <main>
        <h1>Link expired or invalid</h1>
        <p>This reset link is missing or has expired.</p>
        <p>
          <Link to="/forgot-password">Request a new reset link</Link>
        </p>
      </main>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pw = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: pw, token });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Reset failed. The link may have expired.");
      return;
    }
    navigate("/login?reset=1");
  }

  return (
    <main>
      <h1>Set a new password</h1>
      <form onSubmit={onSubmit}>
        <p>
          <label>
            New password
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
        </p>
        <p>
          <label>
            Confirm new password
            <input
              name="confirm"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Set new password"}
        </button>
      </form>
    </main>
  );
}
