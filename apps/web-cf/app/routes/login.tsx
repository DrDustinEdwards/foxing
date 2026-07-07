import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { signIn } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Sign in to Foxing" }];
}

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    navigate("/me");
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <p>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        </p>
        <p>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p>
        <Link to="/signup">Create an account</Link>
      </p>
    </main>
  );
}
