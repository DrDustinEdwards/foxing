import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AuthLink, AuthShell, AuthSubmit, Field } from "~/components/auth-shell";
import { authClient } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Reset password - Foxing" }];
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const linkError = params.get("error");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    // "unavailable" means the link check was interrupted rather than the token being
    // bad, so the retry copy differs. Both cases route back to request a fresh link.
    const interrupted = linkError === "unavailable";
    return (
      <AuthShell
        title={interrupted ? "We couldn't verify that link" : "Link expired or invalid"}
        subtitle={
          interrupted
            ? "Something interrupted the check. Request a new link and try again."
            : "This reset link is missing or has expired."
        }
        footer={<AuthLink to="/forgot-password">Request a new reset link</AuthLink>}
      >
        <p className="ui">Reset links are single-use and expire quickly for security.</p>
      </AuthShell>
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
    void navigate("/login?reset=1");
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a password you don't use elsewhere.">
      <form onSubmit={onSubmit} className="stack">
        <Field
          label="New password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <AuthSubmit pending={pending}>{pending ? "Saving..." : "Set new password"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
