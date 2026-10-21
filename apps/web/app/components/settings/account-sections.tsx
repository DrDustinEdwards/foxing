import { useEffect, useState } from "react";
import { Card, inputClass } from "./settings-card";
import { cn } from "~/lib/cn";
import { authClient } from "~/lib/auth-client";
import { Link } from "react-router";

// Bio length matches the legacy limit so the counter and the stored value agree.
const BIO_MAX = 200;

export function ProfileSection({
  initial,
}: {
  initial: { displayName: string; bio: string; favoriteGenres: string };
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [genres, setGenres] = useState(initial.favoriteGenres);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          favoriteGenres: genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        setError("Could not save your profile. Try again.");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Could not save your profile. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Profile">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between font-ui text-sm text-secondary">
            <span>Bio</span>
            <span
              className={cn(
                "font-mono text-xs",
                bio.length > BIO_MAX ? "text-error" : "text-tertiary",
              )}
            >
              {bio.length} / {BIO_MAX}
            </span>
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">
            Favorite genres (comma separated)
          </span>
          <input
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save profile"}
          </button>
          {status === "saved" ? (
            <span className="font-ui text-sm text-tertiary" role="status">
              Saved.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function UsernameSection({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [avail, setAvail] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(
    "idle",
  );
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalized = value.trim().toLowerCase();
  const changed = normalized !== initial;

  // Debounced live availability check whenever a changed, valid username settles.
  useEffect(() => {
    if (!changed) {
      setAvail("idle");
      return;
    }
    if (!USERNAME_RE.test(normalized)) {
      setAvail("invalid");
      return;
    }
    setAvail("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/me/username-available?username=${encodeURIComponent(normalized)}`,
        );
        const body = (await res.json().catch(() => null)) as { available?: boolean } | null;
        setAvail(body?.available ? "available" : "taken");
      } catch {
        setAvail("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [normalized, changed]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not change your username. Try again.");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Could not change your username. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Username">
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Username</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-tertiary">@</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>
          <span className="mt-1 block font-ui text-xs" aria-live="polite">
            {avail === "checking" ? <span className="text-tertiary">Checking...</span> : null}
            {avail === "available" ? <span className="text-success">Available.</span> : null}
            {avail === "taken" ? <span className="text-error">That username is taken.</span> : null}
            {avail === "invalid" ? (
              <span className="text-error">3 to 30 letters, numbers, or underscores.</span>
            ) : null}
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!(changed && avail === "available") || pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Saving..." : "Change username"}
          </button>
          {status === "saved" ? (
            <span className="font-ui text-sm text-tertiary" role="status">
              Saved.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function EmailSection({ initial }: { initial: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"sent" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await authClient.changeEmail({
        newEmail: email.trim(),
        callbackURL: "/settings",
      });
      if (res.error) {
        setError(res.error.message ?? "Could not change your email.");
        return;
      }
      setStatus("sent");
      setEmail("");
    } catch {
      setError("Could not change your email. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Email">
      <p className="font-ui text-sm text-secondary">
        Your account email is <span className="font-medium text-primary">{initial}</span>. Changing
        it sends a confirmation link to your current address.
      </p>
      <form onSubmit={change} className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">New email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || email.trim().length === 0}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Sending..." : "Change email"}
          </button>
          {status === "sent" ? (
            <span className="font-ui text-sm text-tertiary" role="status">
              Check your inbox to confirm.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function AdminSection() {
  return (
    <Card title="Admin">
      <p className="font-ui text-sm text-secondary">
        You have operator access to the Foxing admin tools.
      </p>
      <Link
        to="/admin"
        className="mt-4 inline-flex rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
      >
        Open admin dashboard
      </Link>
    </Card>
  );
}

export function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"changed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm.length > 0 && next !== confirm;

  async function change(event: React.FormEvent) {
    event.preventDefault();
    // Client-side match check before hitting Better Auth.
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setError(res.error.message ?? "Could not change your password.");
        return;
      }
      setStatus("changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Could not change your password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Password">
      <form onSubmit={change} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Current password</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">New password</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={mismatch}
            className={cn(inputClass, mismatch && "border-error")}
          />
          {mismatch ? (
            <span className="mt-1 block font-ui text-xs text-error" role="alert">
              Passwords do not match.
            </span>
          ) : null}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || mismatch || next.length === 0}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Changing..." : "Change password"}
          </button>
          {status === "changed" ? (
            <span className="font-ui text-sm text-tertiary" role="status">
              Password changed.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="font-ui text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function DataSection() {
  return (
    <Card title="Your data">
      <p className="font-ui text-sm text-secondary">
        Download a JSON archive of everything tied to your account: your profile, library, reading
        history, highlights, notes, and goals.
      </p>
      <a
        href="/api/v1/account/export"
        className="mt-4 inline-flex rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
      >
        Download your data
      </a>
    </Card>
  );
}

const CONFIRM_PHRASE = "delete my account";

export function DangerSection() {
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete your account. Try again.");
        setPending(false);
        return;
      }
      // The account and its data are gone; end the session and return to the marketing
      // page with a full navigation so the root loader re-runs anonymous.
      await authClient.signOut();
      window.location.assign("/");
    } catch {
      setError("Could not delete your account. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <section className="rounded-card border border-error/40 bg-surface p-6">
      <h2 className="font-display text-xl text-error">Delete account</h2>
      <p className="mt-4 font-ui text-sm text-secondary">
        This permanently removes your account and all of your data. It cannot be undone. Type
        <span className="font-medium text-primary"> {CONFIRM_PHRASE} </span>
        to confirm.
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
        placeholder={CONFIRM_PHRASE}
        className={`${inputClass} mt-4`}
      />
      <div className="mt-4">
        <button
          type="button"
          onClick={remove}
          disabled={pending || confirm.trim().toLowerCase() !== CONFIRM_PHRASE}
          className="rounded-md border border-error px-4 py-2 font-ui text-sm text-error hover:bg-error/10 disabled:opacity-40"
        >
          {pending ? "Deleting..." : "Delete my account"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 font-ui text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
