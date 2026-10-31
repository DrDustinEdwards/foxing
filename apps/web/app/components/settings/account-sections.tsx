import {
  useAccountClubs,
  useChangeUsername,
  useDeleteAccount,
  useUpdateMe,
  useUsernameAvailable,
} from "@foxing/client";
import type { ClubHandover } from "@foxing/types";
import { useEffect, useState } from "react";
import { Card, inputClass, SubmitRow } from "./settings-card";
import { authClient, signInAgainIfStale } from "~/lib/auth-client";
import {
  signalCurrentUserDetails,
  signalPasskeys,
  signalUnknownCredential,
} from "@dustinedwards/site-runtime/sign-in-client";
import { useFetcher, useRevalidator } from "react-router";
import { Link } from "capsomer/react/link";

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
    const newEmail = email.trim();
    try {
      // Both mailed links open /email/confirm, which shows how each step went.
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
      <p className="ui">
        Your account email is <span className="strong">{initial}</span>. To change it, approve the
        change from a link sent to this address, then confirm the new address from a link sent
        there.
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
      <p className="ui">You have operator access to the Foxing admin tools.</p>
      <Link to="/admin" className="cap-btn mt-4 fx-account-sections-link">
        Open admin dashboard
      </Link>
    </Card>
  );
}

export type SignInSettings = {
  /** The account's address and display name, as the password manager shows them. */
  email: string;
  displayName: string;
  passkeys: {
    id: string;
    credentialId: string;
    name: string;
    provider: string;
    created: string | null;
    lastUsed: string | null;
  }[];
  /** Exactly one passkey: suggest a second, on another device. */
  secondPasskey: boolean;
  /** The providers the site offers, and whether this account is joined to each. */
  providers: { id: "google" | "apple"; label: string; accountId: string | null }[];
};

/**
 * How the reader signs in (site-runtime ./sign-in): their passkeys, and Google or Apple joined
 * to the account. Joining happens only here, while signed in, never by a matching email at
 * sign-in. The email link always works, so nothing here can lock a reader out.
 */
/** One auth change at a time (keyed, for its button's label): a stale sign-in goes to sign in
 *  again, an error shows in the section, success reloads the settings. */
function useAuthAction() {
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
      if (signInAgainIfStale(res?.error)) return;
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

  return { busy, error, run };
}

export function SignInSection({ initial }: { initial: SignInSettings }) {
  const { busy, error, run } = useAuthAction();
  const [renaming, setRenaming] = useState<string | null>(null);

  // Tells the password manager which passkeys Foxing still accepts and the account's current
  // name (the Signal API), so one removed elsewhere stops being offered.
  useEffect(() => {
    const credentialIds = initial.passkeys.map((p) => p.credentialId);
    // A passkey left out would be dropped from the password manager, so a gap sends nothing.
    if (credentialIds.some((id) => !id)) return;
    void signalPasskeys({
      credentialIds,
      name: initial.email,
      displayName: initial.displayName || undefined,
    });
  }, [initial]);

  return (
    <Card title="Sign-in">
      <div className="stack">
        <p className="ui">
          A passkey signs you in with your face, fingerprint or device PIN. It only works on Foxing,
          so it cannot be phished. You can always sign in with an email link too.
        </p>
        {initial.passkeys.length > 0 ? (
          <ul className="stack-3">
            {initial.passkeys.map((p) =>
              renaming === p.id ? (
                <li key={p.id}>
                  <form
                    className="row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const name = String(
                        new FormData(event.currentTarget).get("name") ?? "",
                      ).trim();
                      if (!name) return;
                      setRenaming(null);
                      void run(
                        p.id,
                        () => authClient.passkey.updatePasskey({ id: p.id, name }),
                        "The passkey was not renamed.",
                      );
                    }}
                  >
                    <label className="grow">
                      <span className="cap-sr-only">Passkey name</span>
                      <input
                        name="name"
                        defaultValue={p.name}
                        maxLength={60}
                        required
                        // biome-ignore lint/a11y/noAutofocus: the field the Rename button opened
                        autoFocus
                        className={inputClass}
                      />
                    </label>
                    <button type="submit" className="cap-btn" data-variant="primary" data-size="sm">
                      Save name
                    </button>
                    <button
                      type="button"
                      className="cap-btn"
                      data-size="sm"
                      onClick={() => setRenaming(null)}
                    >
                      Cancel
                    </button>
                  </form>
                </li>
              ) : (
                <li key={p.id} className="row">
                  <span className="ui grow">
                    <span className="strong">{p.name}</span>
                    <span className="block small dim">
                      {p.provider !== p.name ? `${p.provider}. ` : ""}
                      {p.created ? `Added ${p.created}. ` : ""}
                      {p.lastUsed ? `Last used ${p.lastUsed}.` : "Not used to sign in yet."}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="cap-btn"
                    data-size="sm"
                    disabled={busy !== null}
                    onClick={() => setRenaming(p.id)}
                  >
                    Rename<span className="cap-sr-only"> {p.name}</span>
                  </button>
                  <button
                    type="button"
                    className="cap-btn"
                    data-size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        p.id,
                        async () => {
                          const res = await authClient.passkey.deletePasskey({ id: p.id });
                          // Gone here, so the password manager stops offering it.
                          if (!res.error && p.credentialId)
                            void signalUnknownCredential({
                              rpId: location.hostname,
                              credentialId: p.credentialId,
                            });
                          return res;
                        },
                        "The passkey was not removed.",
                      )
                    }
                  >
                    Remove<span className="cap-sr-only"> {p.name}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
        ) : null}
        {initial.secondPasskey ? (
          <p className="ui small">
            Add a passkey on a second device too, so you can still use a passkey if you lose this
            one.
          </p>
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
            {busy === "add"
              ? "Waiting for your device..."
              : initial.passkeys.length > 0
                ? "Add another passkey"
                : "Create a passkey"}
          </button>
        </div>
        {initial.providers.map((provider) => (
          <div key={provider.id} className="row">
            <span className="ui grow">
              {provider.label}: {provider.accountId ? "connected" : "not connected"}
            </span>
            {provider.accountId ? (
              <button
                type="button"
                className="cap-btn"
                data-size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    provider.id,
                    () => authClient.unlinkAccount({ accountId: provider.accountId ?? "" }),
                    `${provider.label} was not disconnected.`,
                  )
                }
              >
                Disconnect {provider.label}
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

export type SessionSettings = {
  id: string;
  device: string;
  location: string | null;
  current: boolean;
  signedIn: string;
  lastActive: string;
}[];

/**
 * Where the reader is signed in (site-runtime ./sign-in sessionRows), this device first. Listing
 * them needs a recent sign-in, so `null` offers one. Signing a device out ends its session through
 * the settings page's action, by id.
 */
export function SessionsSection({ sessions }: { sessions: SessionSettings | null }) {
  const { busy, error, run } = useAuthAction();
  const signOut = useFetcher<{ revoked: boolean }>();
  const failed = signOut.data?.revoked === false ? "The device was not signed out." : null;

  if (!sessions)
    return (
      <Card title="Signed-in devices">
        <p className="ui">To see where you are signed in, sign in again.</p>
        <Link to="/login?next=%2Fsettings" className="cap-btn mt-4 fx-account-sections-link">
          Sign in again
        </Link>
      </Card>
    );

  const others = sessions.filter((s) => !s.current).length;
  return (
    <Card title="Signed-in devices">
      <div className="stack">
        <ul className="stack-3">
          {sessions.map((s) => (
            <li key={s.id} className="row">
              <span className="ui grow">
                <span className="strong">{s.device}</span>
                {s.current ? " (this device)" : null}
                <span className="block small dim">
                  {s.location ? `${s.location}. ` : ""}Signed in {s.signedIn}, last active{" "}
                  {s.lastActive}.
                </span>
              </span>
              {s.current ? null : (
                <signOut.Form method="post">
                  <input type="hidden" name="session" value={s.id} />
                  <button
                    type="submit"
                    className="cap-btn"
                    data-size="sm"
                    disabled={busy !== null || signOut.state !== "idle"}
                  >
                    Sign out<span className="cap-sr-only"> {s.device}</span>
                  </button>
                </signOut.Form>
              )}
            </li>
          ))}
        </ul>
        {others > 0 ? (
          <div>
            <button
              type="button"
              className="cap-btn"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  "others",
                  () => authClient.revokeOtherSessions(),
                  "The other devices were not signed out.",
                )
              }
            >
              {busy === "others" ? "Signing out..." : "Sign out all other devices"}
            </button>
          </div>
        ) : null}
        {error || failed ? (
          <p role="alert" className="error">
            {error ?? failed}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export type SecurityActivity = {
  what: string;
  when: string;
  device: string | null;
  location: string | null;
}[];

/** The last ten sign-ins and sign-in changes (site-runtime securityHistory), newest first, so a
 *  reader can spot one that was not theirs. */
export function SecurityHistorySection({ activity }: { activity: SecurityActivity }) {
  return (
    <Card title="Recent security activity">
      {activity.length === 0 ? (
        <p className="ui">Nothing yet. Sign-ins and changes to how you sign in will show here.</p>
      ) : (
        <ul className="stack-3">
          {activity.map((a, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, newest-first list that never reorders on screen
            <li key={i} className="ui">
              <span className="strong">{a.what}</span>
              <span className="block small dim">
                {[a.when, a.device, a.location].filter(Boolean).join(". ")}.
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 small dim">
        Something you do not recognize? Sign out the other devices above and remove any passkey you
        did not add.
      </p>
    </Card>
  );
}

/** The export needs a sign-in from the last 10 minutes; past that, `fresh` is false and the
 *  section offers one first. */
export function DataSection({ fresh }: { fresh: boolean }) {
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
        <Link to="/login?next=%2Fsettings" className="cap-btn mt-4 fx-account-sections-link">
          Sign in again
        </Link>
      )}
    </Card>
  );
}

const CONFIRM_PHRASE = "delete my account";
const DELETE_CLUB = "";

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

/** Deleting needs a sign-in from the last 10 minutes (Better Auth's deleteUser); past that,
 *  `fresh` is false and the section offers one first, as Signed-in devices does. */
export function DangerSection({ fresh }: { fresh: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState(false);
  const owned = useAccountClubs();
  const clubs = owned.data ?? null;
  const del = useDeleteAccount();
  const pending = del.pending || leaving;
  const error =
    del.error ??
    (owned.isError ? "Could not load your clubs. Reload the page before deleting." : null);

  async function remove() {
    const successors: Record<string, string | null> = {};
    for (const club of clubs ?? []) {
      if (club.candidates.length === 0) continue;
      const picked = choice[club.clubId] ?? club.suggested ?? DELETE_CLUB;
      successors[club.clubId] = picked === DELETE_CLUB ? null : picked;
    }
    if (!(await del.run({ successors }))) return;
    // The account and its data are gone; end the session and return to the marketing
    // page with a full navigation so the root loader re-runs anonymous.
    setLeaving(true);
    await authClient.signOut();
    window.location.assign("/");
  }

  if (!fresh)
    return (
      <section className="fx-account-sections-card">
        <h2 className="fx-account-sections-title">Delete account</h2>
        <p className="mt-4 fx-account-sections-text">
          This permanently removes your account and all of your data. To keep someone else from
          doing it on a device you left signed in, sign in again first.
        </p>
        <Link to="/login?next=%2Fsettings" className="cap-btn mt-4 fx-account-sections-link">
          Sign in again
        </Link>
      </section>
    );

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
