import { useState } from "react";
import { Link } from "react-router";
import { TurnstileWidget } from "~/components/turnstile";
import { cloudflareContext } from "~/context";
import { signUp } from "~/lib/auth-client";
import type { Route } from "./+types/signup";

export function meta() {
  return [{ title: "Create your Foxing account" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return {
    turnstile: {
      enabled: String(env.TURNSTILE_ENABLED) === "true",
      siteKey: env.TURNSTILE_SITE_KEY ?? "",
    },
  };
}

export default function Signup({ loaderData }: Route.ComponentProps) {
  const { turnstile } = loaderData;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await signUp.email(
      {
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        callbackURL: "/onboarding",
      },
      turnstile.enabled ? { headers: { "x-captcha-response": captchaToken } } : undefined,
    );
    setPending(false);
    if (res.error) {
      // Treat "email already registered" identically to success so callers
      // cannot enumerate whether an address is in use.
      const isExisting =
        (res.error as { code?: string }).code === "USER_ALREADY_EXISTS" ||
        res.error.message?.toLowerCase().includes("already exists");
      if (!isExisting) {
        setError(res.error.message ?? "Sign up failed.");
        return;
      }
    }
    setDone(true);
  }

  if (done) {
    return (
      <main>
        <h1>Check your email</h1>
        <p>We sent a link to confirm your address. Open it to finish setting up your account.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Create your account</h1>
      <form onSubmit={onSubmit}>
        <p>
          <label>
            Name
            <input name="name" required autoComplete="name" />
          </label>
        </p>
        <p>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        </p>
        <p>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
        </p>
        {turnstile.enabled ? (
          <TurnstileWidget siteKey={turnstile.siteKey} onToken={setCaptchaToken} />
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create account"}
        </button>
      </form>
      <p>
        <Link to="/login">Already have an account?</Link>
      </p>
    </main>
  );
}
