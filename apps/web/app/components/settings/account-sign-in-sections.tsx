import { useEffect, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import {
  signalPasskeys,
  signalUnknownCredential,
} from "@dustinedwards/site-runtime/sign-in-client";
import { ButtonLink } from "capsomer/react/link";
import { Card, inputClass } from "./settings-card";
import { authClient, signInAgainIfStale } from "~/lib/auth-client";
import { signInHref } from "~/lib/sign-in-path";

export type SignInSettings = {
  userId: string;
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
  providers: { id: "google" | "apple"; label: string; accountId: string | null }[];
};

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

  useEffect(() => {
    const credentialIds = initial.passkeys.map((p) => p.credentialId);
    // A passkey left out would be dropped from the password manager, so a gap sends nothing.
    if (credentialIds.some((id) => !id)) return;
    void signalPasskeys({
      user: initial.userId,
      credentialIds,
      name: initial.email,
      displayName: initial.displayName || undefined,
    });
  }, [initial]);

  return (
    <Card title="Sign-in">
      <div className="cap-stack">
        {initial.passkeys.length > 0 ? (
          <ul className="cap-stack" data-gap="4">
            {initial.passkeys.map((p) =>
              renaming === p.id ? (
                <li key={p.id}>
                  <form
                    className="cap-cluster"
                    data-gap="4"
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
                    <label className="cap-grow">
                      <span className="cap-sr-only">Passkey name</span>
                      <input
                        name="name"
                        defaultValue={p.name}
                        maxLength={60}
                        required
                        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the field the Rename button opened
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
                <li key={p.id} className="cap-cluster" data-gap="4">
                  <span
                    className="cap-text cap-grow"
                    data-size="small"
                    data-tone="muted"
                    data-face="ui"
                  >
                    <span className="cap-text" data-tone="ink" data-weight="strong">
                      {p.name}
                    </span>
                    <span className="cap-text block" data-size="small" data-tone="dim">
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
          <div key={provider.id} className="cap-cluster" data-gap="4">
            <span className="cap-text cap-grow" data-size="small" data-tone="muted" data-face="ui">
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
          <p role="alert" className="cap-text" data-size="small" data-tone="crit" data-face="ui">
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

export function SessionsSection({ sessions }: { sessions: SessionSettings | null }) {
  const { busy, error, run } = useAuthAction();
  const signOut = useFetcher<{ revoked: boolean }>();
  const failed = signOut.data?.revoked === false ? "The device was not signed out." : null;

  if (!sessions)
    return (
      <Card title="Signed-in devices">
        <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
          To see where you are signed in, sign in again.
        </p>
        <ButtonLink to={signInHref("/settings")}>Sign in again</ButtonLink>
      </Card>
    );

  const others = sessions.filter((s) => !s.current).length;
  return (
    <Card title="Signed-in devices">
      <div className="cap-stack">
        <ul className="cap-stack" data-gap="4">
          {sessions.map((s) => (
            <li key={s.id} className="cap-cluster" data-gap="4">
              <span
                className="cap-text cap-grow"
                data-size="small"
                data-tone="muted"
                data-face="ui"
              >
                <span className="cap-text" data-tone="ink" data-weight="strong">
                  {s.device}
                </span>
                {s.current ? " (this device)" : null}
                <span className="cap-text block" data-size="small" data-tone="dim">
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
          <p role="alert" className="cap-text" data-size="small" data-tone="crit" data-face="ui">
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

export function SecurityHistorySection({ activity }: { activity: SecurityActivity }) {
  return (
    <Card title="Recent security activity">
      {activity.length === 0 ? (
        <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
          Nothing yet.
        </p>
      ) : (
        <ul className="cap-stack" data-gap="4">
          {activity.map((a, i) => (
            <li key={i} className="cap-text" data-size="small" data-tone="muted" data-face="ui">
              <span className="cap-text" data-tone="ink" data-weight="strong">
                {a.what}
              </span>
              <span className="cap-text block" data-size="small" data-tone="dim">
                {[a.when, a.device, a.location].filter(Boolean).join(". ")}.
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="cap-text" data-size="small" data-tone="dim">
        Something you do not recognize? Sign out the other devices above and remove any passkey you
        did not add.
      </p>
    </Card>
  );
}
