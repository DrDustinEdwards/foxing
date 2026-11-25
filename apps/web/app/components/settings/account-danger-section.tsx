import { useAccountClubs, useDeleteAccount } from "@foxing/client";
import type { ClubHandover } from "@foxing/types";
import { useState } from "react";
import { ButtonLink } from "capsomer/react/link";
import { NativeSelect } from "capsomer/react/select-native";
import { inputClass } from "./settings-card";
import { signOutToHome } from "~/lib/auth-client";
import { FormError } from "~/components/ui";
import { signInHref } from "~/lib/sign-in-path";

const CONFIRM_PHRASE = "delete my account";
const DELETE_CLUB = "";

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
    <fieldset className="fx-account-sections-form">
      <legend className="cap-text" data-size="small" data-tone="muted" data-face="ui">
        You created {clubs.length === 1 ? "a club" : `${clubs.length} clubs`}. Choose who takes each
        one over, so its members keep their discussions.
      </legend>
      {clubs.map((club) =>
        club.candidates.length === 0 ? (
          <p
            key={club.clubId}
            className="cap-text"
            data-size="small"
            data-tone="muted"
            data-face="ui"
          >
            <span className="cap-text" data-tone="ink" data-weight="strong">
              {club.name}
            </span>{" "}
            has no other members, so it will be deleted with your account.
          </p>
        ) : (
          <label key={club.clubId} className="cap-stack fx-account-sections-field" data-gap="2">
            <span className="cap-text" data-tone="ink" data-weight="strong">
              {club.name}
            </span>
            <NativeSelect
              data-fill="ground"
              value={choice[club.clubId] ?? club.suggested ?? DELETE_CLUB}
              onChange={(e) => onChoose(club.clubId, e.target.value)}
              options={[
                ...club.candidates.map((m) => ({
                  value: m.userId,
                  label: m.role === "moderator" ? `${m.name} (moderator)` : m.name,
                })),
                { value: DELETE_CLUB, label: "Nobody: delete the club and all its posts" },
              ]}
            />
          </label>
        ),
      )}
    </fieldset>
  );
}

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
    setLeaving(true);
    await signOutToHome();
  }

  if (!fresh)
    return (
      <section className="cap-stack fx-account-sections-card">
        <h2 className="fx-account-sections-title">Delete account</h2>
        <p className="fx-account-sections-text">
          This permanently removes your account and all of your data. To keep someone else from
          doing it on a device you left signed in, sign in again first.
        </p>
        <ButtonLink to={signInHref("/settings")}>Sign in again</ButtonLink>
      </section>
    );

  return (
    <section className="cap-stack fx-account-sections-card">
      <h2 className="fx-account-sections-title">Delete account</h2>
      <p className="fx-account-sections-text">
        This permanently removes your account and all of your data. It cannot be undone. Type
        <span className="cap-text" data-tone="ink" data-weight="strong">
          {" "}
          {CONFIRM_PHRASE}{" "}
        </span>
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
        className={inputClass}
      />
      <div className="cap-stack" data-gap="4">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={pending || clubs === null || confirm.trim().toLowerCase() !== CONFIRM_PHRASE}
          className="cap-btn"
          data-variant="danger"
        >
          {pending ? "Deleting..." : "Delete my account"}
        </button>
        <FormError error={error} />
      </div>
    </section>
  );
}
