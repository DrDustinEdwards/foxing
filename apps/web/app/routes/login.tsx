import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AuthDivider,
  AuthLink,
  AuthShell,
  AuthSubmit,
  Field,
  GoogleButton,
  MagicLinkForm,
  RevealLink,
} from "~/components/auth-shell";
import { signIn } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Sign in to Foxing" }];
}

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordReset = params.get("reset") === "1";
  const oauthError = params.get("error") === "oauth";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Sign in failed.");
      return;
    }
    void navigate("/me");
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Foxing."
      footer={
        <>
          New to Foxing? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      {passwordReset ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-border-subtle bg-sunken px-3 py-2 font-ui text-sm text-secondary"
        >
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {oauthError ? (
        <p role="alert" className="mb-4 font-ui text-sm text-error">
          Google sign-in did not complete. Try again or use another method.
        </p>
      ) : null}

      <div className="space-y-4">
        <GoogleButton />
        <AuthDivider />
        <MagicLinkForm />

        {showPassword ? (
          <form onSubmit={onSubmit} className="space-y-4 border-t border-border-subtle pt-4">
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <div>
              <Field
                label="Password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <AuthLink to="/forgot-password">Forgot your password?</AuthLink>
              </div>
            </div>
            {error ? (
              <p role="alert" className="font-ui text-sm text-error">
                {error}
              </p>
            ) : null}
            <AuthSubmit pending={pending}>{pending ? "Signing in..." : "Sign in"}</AuthSubmit>
          </form>
        ) : (
          <RevealLink onClick={() => setShowPassword(true)}>Use a password instead</RevealLink>
        )}
      </div>
    </AuthShell>
  );
}
