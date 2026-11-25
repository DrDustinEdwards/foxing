import { useChangeUsername, useUpdateMe, useUsernameAvailable } from "@foxing/client";
import { useId, useState } from "react";
import { Card, inputClass, SubmitRow } from "./settings-card";
import { authClient } from "~/lib/auth-client";
import { signalCurrentUserDetails } from "@dustinedwards/site-runtime/sign-in-client";
import { ButtonLink } from "capsomer/react/link";
import { signInHref } from "~/lib/sign-in-path";

const BIO_MAX = 200;

export function ProfileSection({
  initial,
}: {
  initial: {
    userId: string;
    email: string;
    displayName: string;
    bio: string;
    favoriteGenres: string;
  };
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [genres, setGenres] = useState(initial.favoriteGenres);
  const [status, setStatus] = useState<"saved" | null>(null);
  const { run, pending, error } = useUpdateMe();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    const saved = await run({
      displayName: displayName.trim() || null,
      bio: bio.trim() || null,
      favoriteGenres: genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
    });
    if (!saved) return;
    setStatus("saved");
    void signalCurrentUserDetails({
      user: initial.userId,
      name: initial.email,
      displayName: displayName.trim() || undefined,
    });
  }

  return (
    <Card title="Profile">
      <form onSubmit={(e) => void save(e)} className="cap-stack">
        <label className="cap-field">
          <span className="fx-label">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="cap-stack" data-gap="2">
          <span className="fx-account-sections-label">
            Bio
            <span
              className="cap-text"
              data-size="tiny"
              data-face="mono"
              data-tone={bio.length > BIO_MAX ? "crit" : "dim"}
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
        <label className="cap-field">
          <span className="fx-label">Favorite genres (comma separated)</span>
          <input
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            className={inputClass}
          />
        </label>
        <SubmitRow
          disabled={pending}
          pending={pending}
          label="Save profile"
          pendingLabel="Saving..."
          done={status === "saved" ? "Saved." : null}
          error={error}
        />
      </form>
    </Card>
  );
}

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function UsernameSection({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"saved" | null>(null);
  const { run, pending, error } = useChangeUsername();
  const inputId = useId();
  const normalized = value.trim().toLowerCase();
  const changed = normalized !== saved;
  const valid = USERNAME_RE.test(normalized);
  const available = useUsernameAvailable(normalized, changed && valid);
  const avail = !changed
    ? "idle"
    : !valid
      ? "invalid"
      : available === null
        ? "checking"
        : available
          ? "available"
          : "taken";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    if (await run({ username: normalized })) {
      setSaved(normalized);
      setStatus("saved");
    }
  }

  return (
    <Card title="Username">
      <form onSubmit={(e) => void save(e)} className="cap-stack" data-gap="4">
        <label className="cap-field" htmlFor={inputId}>
          <span className="fx-label">Username</span>
          <span className="cap-stack" data-gap="2">
            <span className="cap-cluster" data-gap="3">
              <span className="fx-account-sections-label-2">@</span>
              <input
                id={inputId}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={inputClass}
              />
            </span>
            <span className="fx-account-sections-label-3" aria-live="polite">
              {avail === "checking" ? (
                <span className="cap-text" data-tone="dim">
                  Checking...
                </span>
              ) : null}
              {avail === "available" ? (
                <span className="fx-account-sections-label-4">Available.</span>
              ) : null}
              {avail === "taken" ? (
                <span className="cap-text" data-size="small" data-tone="crit" data-face="ui">
                  That username is taken.
                </span>
              ) : null}
              {avail === "invalid" ? (
                <span className="cap-text" data-size="small" data-tone="crit" data-face="ui">
                  3 to 30 letters, numbers, or underscores.
                </span>
              ) : null}
            </span>
          </span>
        </label>
        <SubmitRow
          disabled={!(changed && avail === "available") || pending}
          pending={pending}
          label="Change username"
          pendingLabel="Saving..."
          done={status === "saved" ? "Saved." : null}
          error={error}
        />
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
    const newEmail = email.trim();
    try {
      const res = await authClient.changeEmail({ newEmail });
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
      <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
        <span className="cap-text" data-tone="ink" data-weight="strong">
          {initial}
        </span>
        . We will email a link to both addresses.
      </p>
      <form onSubmit={(e) => void change(e)} className="cap-stack" data-gap="4">
        <label className="cap-field">
          <span className="fx-label">New email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={inputClass}
          />
        </label>
        <SubmitRow
          disabled={pending || email.trim().length === 0}
          pending={pending}
          label="Change email"
          pendingLabel="Sending..."
          done={status === "sent" ? `Check ${initial} for the link to approve the change.` : null}
          error={error}
        />
      </form>
    </Card>
  );
}

export function AdminSection() {
  return (
    <Card title="Admin">
      <ButtonLink to="/admin">Open admin dashboard</ButtonLink>
    </Card>
  );
}

export function DataSection({ fresh }: { fresh: boolean }) {
  return (
    <Card title="Your data">
      {fresh ? null : (
        <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
          Sign in again first.
        </p>
      )}
      {fresh ? (
        <ButtonLink href="/api/v1/account/export">Download your data</ButtonLink>
      ) : (
        <ButtonLink to={signInHref("/settings")}>Sign in again</ButtonLink>
      )}
    </Card>
  );
}
