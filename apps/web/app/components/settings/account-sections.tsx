import { useEffect, useState } from "react";
import { Card, inputClass, SubmitRow } from "./settings-card";
import { authClient } from "~/lib/auth-client";
import { Link, useRevalidator } from "react-router";

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
      <form onSubmit={save} className="stack">
        <label className="block">
          <span className="fx-label">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 fx-account-sections-label">
            <span>Bio</span>
            <span className={bio.length > BIO_MAX ? "mono xsmall crit" : "mono xsmall dim"}>
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
      <form onSubmit={save} className="stack-3">
        <label className="block">
          <span className="fx-label">Username</span>
          <div className="row-2">
            <span className="fx-account-sections-label-2">@</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
          </div>
          <span className="mt-1 block fx-account-sections-label-3" aria-live="polite">
            {avail === "checking" ? <span className="dim">Checking...</span> : null}
            {avail === "available" ? (
              <span className="fx-account-sections-label-4">Available.</span>
            ) : null}
            {avail === "taken" ? <span className="error">That username is taken.</span> : null}
            {avail === "invalid" ? (
              <span className="error">3 to 30 letters, numbers, or underscores.</span>
            ) : null}
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
      <p className="ui">
        Your account email is <span className="strong">{initial}</span>. Changing it sends a
        confirmation link to your current address.
      </p>
      <form onSubmit={change} className="mt-4 fx-account-sections-form">
        <label className="block">
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
          done={status === "sent" ? "Check your inbox to confirm." : null}
          error={error}
        />
      </form>
    </Card>
  );
}

export function AdminSection() {
  return (
    <Card title="Admin">
      <p className="ui">You have operator access to the Foxing admin tools.</p>
      <Link to="/admin" className="cap-btn mt-4 fx-account-sections-link">
        Open admin dashboard
      </Link>
    </Card>
  );
}

export type SignInSettings = {
  passkeys: { id: string; name: string; createdAt: string | null }[];
  /** The providers the site offers, and whether this account is joined to each. */
  providers: { id: "google" | "apple"; label: string; linked: boolean }[];
};

/**
 * How the reader signs in (site-runtime ./sign-in): their passkeys, and Google or Apple joined
 * to the account. Joining happens only here, while signed in, never by a matching email at
 * sign-in. The email link always works, so nothing here can lock a reader out.
 */
export function SignInSection({ initial }: { initial: SignInSettings }) {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    key: string,
    action: () => Promise<{ error?: unknown } | null | undefined>,
    failed: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      const res = await action();
      if (res?.error) {
        const message = (res.error as { message?: string }).message;
        setError(message ? `${failed} ${message}` : failed);
        return;
      }
      void revalidator.revalidate();
    } catch {
      setError(`${failed} Check your connection and try again.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Sign-in">
      <div className="stack">
        <p className="ui">
          A passkey signs you in with your face, fingerprint or device PIN. It only works on Foxing,
          so it cannot be phished. You can always sign in with an email link too.
        </p>
        {initial.passkeys.length > 0 ? (
          <ul className="stack-3">
            {initial.passkeys.map((p) => (
              <li key={p.id} className="row">
                <span className="ui grow">{p.name}</span>
                <button
                  type="button"
                  className="cap-btn"
                  data-size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      p.id,
                      () => authClient.passkey.deletePasskey({ id: p.id }),
                      "The passkey was not removed.",
                    )
                  }
                >
                  Remove<span className="cap-sr-only"> {p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <button
            type="button"
            className="cap-btn"
            data-variant="primary"
            disabled={busy !== null}
            onClick={() =>
              void run("add", () => authClient.passkey.addPasskey(), "The passkey was not saved.")
            }
          >
            {busy === "add" ? "Waiting for your device..." : "Add a passkey"}
          </button>
        </div>
        {initial.providers.map((provider) => (
          <div key={provider.id} className="row">
            <span className="ui grow">
              {provider.label}: {provider.linked ? "connected" : "not connected"}
            </span>
            {provider.linked ? (
              <button
                type="button"
                className="cap-btn"
                data-size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    provider.id,
                    () => authClient.unlinkAccount({ providerId: provider.id }),
                    `${provider.label} was not disconnected.`,
                  )
                }
              >
                Disconnect<span className="cap-sr-only"> {provider.label}</span>
              </button>
            ) : (
              <button
                type="button"
                className="cap-btn"
                data-size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    provider.id,
                    () =>
                      authClient.linkSocial({ provider: provider.id, callbackURL: "/settings" }),
                    `${provider.label} was not connected.`,
                  )
                }
              >
                Connect<span className="cap-sr-only"> {provider.label}</span>
              </button>
            )}
          </div>
        ))}
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function DataSection() {
  return (
    <Card title="Your data">
      <p className="ui">
        Download a JSON archive of everything tied to your account: your profile, library, reading
        history, highlights, notes, and goals.
      </p>
      <a href="/api/v1/account/export" className="cap-btn mt-4 fx-account-sections-link">
        Download your data
      </a>
    </Card>
  );
}

const CONFIRM_PHRASE = "delete my account";
const DELETE_CLUB = "";

type ClubHandover = {
  clubId: string;
  name: string;
  candidates: { userId: string; name: string; role: string }[];
  suggested: string | null;
};

/** Clubs the user created: each passes to a member they pick before the account goes, so
 *  their leaving does not delete everyone else's discussion. */
function ClubHandoverFields({
  clubs,
  choice,
  onChoose,
}: {
  clubs: ClubHandover[];
  choice: Record<string, string>;
  onChoose: (clubId: string, userId: string) => void;
}) {
  if (clubs.length === 0) return null;
  return (
    <fieldset className="mt-4 fx-account-sections-form">
      <legend className="ui">
        You created {clubs.length === 1 ? "a club" : `${clubs.length} clubs`}. Choose who takes each
        one over, so its members keep their discussions.
      </legend>
      {clubs.map((club) =>
        club.candidates.length === 0 ? (
          <p key={club.clubId} className="ui">
            <span className="strong">{club.name}</span> has no other members, so it will be deleted
            with your account.
          </p>
        ) : (
          <label key={club.clubId} className="block fx-account-sections-field">
            <span className="strong">{club.name}</span>
            <select
              value={choice[club.clubId] ?? club.suggested ?? DELETE_CLUB}
              onChange={(e) => onChoose(club.clubId, e.target.value)}
              className={`${inputClass} mt-1`}
            >
              {club.candidates.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                  {m.role === "moderator" ? " (moderator)" : ""}
                </option>
              ))}
              <option value={DELETE_CLUB}>Nobody: delete the club and all its posts</option>
            </select>
          </label>
        ),
      )}
    </fieldset>
  );
}

export function DangerSection() {
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clubs, setClubs] = useState<ClubHandover[] | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/v1/account/clubs")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { clubs: ClubHandover[] };
        setClubs(data.clubs);
      })
      .catch(() => setError("Could not load your clubs. Reload the page before deleting."));
  }, []);

  async function remove() {
    setPending(true);
    setError(null);
    const successors: Record<string, string | null> = {};
    for (const club of clubs ?? []) {
      if (club.candidates.length === 0) continue;
      const picked = choice[club.clubId] ?? club.suggested ?? DELETE_CLUB;
      successors[club.clubId] = picked === DELETE_CLUB ? null : picked;
    }
    try {
      const res = await fetch("/api/v1/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successors }),
      });
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
    <section className="fx-account-sections-card">
      <h2 className="fx-account-sections-title">Delete account</h2>
      <p className="mt-4 fx-account-sections-text">
        This permanently removes your account and all of your data. It cannot be undone. Type
        <span className="strong"> {CONFIRM_PHRASE} </span>
        to confirm.
      </p>
      <ClubHandoverFields
        clubs={clubs ?? []}
        choice={choice}
        onChoose={(clubId, userId) => setChoice((c) => ({ ...c, [clubId]: userId }))}
      />
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
          disabled={pending || clubs === null || confirm.trim().toLowerCase() !== CONFIRM_PHRASE}
          className="cap-btn"
          data-variant="danger"
        >
          {pending ? "Deleting..." : "Delete my account"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
