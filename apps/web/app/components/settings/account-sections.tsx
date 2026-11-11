import { useChangeUsername, useUpdateMe, useUsernameAvailable } from "@foxing/client";
import type { ClubHandover } from "@foxing/types";
import { useState } from "react";
import { Card, inputClass, SubmitRow } from "./settings-card";
import { signalCurrentUserDetails } from "@dustinedwards/site-runtime/sign-in-client";
import { Field } from "capsomer/react/field";
import { Link } from "capsomer/react/link";
import { Select } from "capsomer/react/select";

// Foxing's own parts of Settings. The account parts (email, passkeys, Google and Apple, devices,
// history, deletion) are Capsomer's (capsomer/react/sign-in-settings), in routes/settings.tsx.

// Bio length matches the legacy limit so the counter and the stored value agree.
const BIO_MAX = 200;

export function ProfileSection({
  initial,
}: {
  initial: { email: string; displayName: string; bio: string; favoriteGenres: string };
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
    // The password manager shows the new name beside this account's passkeys (the Signal API).
    void signalCurrentUserDetails({
      name: initial.email,
      displayName: displayName.trim() || undefined,
    });
  }

  return (
    <Card title="Profile">
      <form onSubmit={(e) => void save(e)} className="stack">
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
            Bio
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
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"saved" | null>(null);
  const { run, pending, error } = useChangeUsername();
  const normalized = value.trim().toLowerCase();
  const changed = normalized !== saved;
  const valid = USERNAME_RE.test(normalized);
  // Debounced live availability check whenever a changed, valid username settles.
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
      <form onSubmit={(e) => void save(e)} className="stack-3">
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

/** The export needs a sign-in from the last 10 minutes; past that, `fresh` is false and the
 *  section offers one first. */
export function DataSection({
  fresh,
  signInAgainHref,
}: {
  fresh: boolean;
  signInAgainHref: string;
}) {
  return (
    <Card title="Your data">
      <p className="ui">
        Download a JSON archive of everything tied to your account: your profile, library, reading
        history, highlights, notes, and goals.
        {fresh ? null : " It holds everything, so sign in again first."}
      </p>
      {fresh ? (
        <a href="/api/v1/account/export" className="cap-btn mt-4 fx-account-sections-link">
          Download your data
        </a>
      ) : (
        <Link to={signInAgainHref} className="cap-btn mt-4 fx-account-sections-link">
          Sign in again
        </Link>
      )}
    </Card>
  );
}

/** The field that names who takes over a club, by the club's id; "" deletes the club. */
export const successorField = (clubId: string) => `successor:${clubId}`;

/** Deleting the account: each club the reader created passes to a member they pick, so their
 *  leaving does not delete everyone else's discussion (Dustin, 2026-10-23). Fields of the
 *  deletion's form (DeleteAccount's `fields`); the settings route's action hands them over. */
export function ClubHandoverFields({ clubs }: { clubs: ClubHandover[] }) {
  if (clubs.length === 0) return null;
  return (
    <fieldset className="fx-account-sections-form">
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
          <Field key={club.clubId} label={club.name}>
            <Select
              name={successorField(club.clubId)}
              defaultValue={club.suggested ?? ""}
              options={[
                ...club.candidates.map((m) => ({
                  value: m.userId,
                  label: m.role === "moderator" ? `${m.name} (moderator)` : m.name,
                })),
                { value: "", label: "Nobody: delete the club and all its posts" },
              ]}
            />
          </Field>
        ),
      )}
    </fieldset>
  );
}
