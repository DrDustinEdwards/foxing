import {
  NOTIFICATION_LABELS,
  useBillingPortal,
  usePeople,
  useSetNotificationPrefs,
  useSetVisibility,
} from "@foxing/client";
import type { PeoplePage } from "@foxing/types";
import { useState } from "react";
import { Card, inputClass, SubmitRow, ToggleRow } from "./settings-card";
import { Select } from "capsomer/react/select";
import { ThemeSwitch } from "capsomer/react/theme-switch";
import { THEME_PREF_KEY } from "~/lib/theme";
import { Link } from "capsomer/react/link";
import { Avatar, FormError } from "~/components/ui";
import { CloseFriendToggle } from "~/components/social/close-friend-toggle";

export function BillingSection({
  tier,
  status,
  periodEndLabel,
  onUpgrade,
}: {
  tier: "free" | "plus";
  status: string | null;
  periodEndLabel: string | null;
  /** Opens the paywall, or null while Plus cannot be bought (billing not configured). */
  onUpgrade: (() => void) | null;
}) {
  const portal = useBillingPortal();
  // Stays pending while the browser leaves for Stripe.
  const [leaving, setLeaving] = useState(false);
  const pending = portal.pending || leaving;
  const { error } = portal;
  const isPlus = tier === "plus";

  async function manage() {
    const r = await portal.run();
    if (r) {
      setLeaving(true);
      window.location.assign(r.url);
    }
  }

  return (
    <Card title="Plan">
      <div className="cap-stack" data-gap="4">
        {isPlus ? (
          <>
            <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
              You are on{" "}
              <span className="cap-text" data-tone="ink" data-weight="strong">
                Foxing Plus
              </span>
              {status ? ` (${status})` : ""}.{periodEndLabel ? ` Renews ${periodEndLabel}.` : ""}
            </p>
            <button
              type="button"
              onClick={() => void manage()}
              disabled={pending}
              className="cap-btn"
            >
              {pending ? "Opening..." : "Manage billing"}
            </button>
          </>
        ) : (
          <>
            <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
              You are on the{" "}
              <span className="cap-text" data-tone="ink" data-weight="strong">
                Free
              </span>{" "}
              plan.
              {onUpgrade ? "" : " Plus is not open for sign-up yet."}
            </p>
            {onUpgrade ? (
              <button
                type="button"
                onClick={onUpgrade}
                className="cap-btn self-start"
                data-variant="primary"
              >
                Upgrade to Plus
              </button>
            ) : null}
          </>
        )}
        <FormError error={error} />
      </div>
    </Card>
  );
}

type VisibilityValues = {
  profile: "public" | "private";
  progress: "public" | "private";
  defaultAnnotation: "private" | "friends" | "public";
};

export function VisibilitySection({ initial }: { initial: VisibilityValues }) {
  const [profile, setProfile] = useState(initial.profile);
  const [progress, setProgress] = useState(initial.progress);
  const [defaultAnnotation, setDefaultAnnotation] = useState(initial.defaultAnnotation);
  const [status, setStatus] = useState<"saved" | null>(null);
  const { run, pending, error } = useSetVisibility();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    if (await run({ profile, progress, defaultAnnotation })) setStatus("saved");
  }

  return (
    <Card title="Visibility">
      <form onSubmit={(e) => void save(e)} className="cap-stack">
        <ToggleRow
          checked={profile === "public"}
          onChange={(on) => setProfile(on ? "public" : "private")}
          label="Public profile"
        />
        <ToggleRow
          checked={progress === "public"}
          onChange={(on) => setProgress(on ? "public" : "private")}
          label="Share reading progress"
        />
        <label className="cap-field">
          <span className="fx-label">Default highlight and note audience</span>
          <Select
            native
            data-fill="ground"
            value={defaultAnnotation}
            onChange={(e) =>
              setDefaultAnnotation(e.target.value as VisibilityValues["defaultAnnotation"])
            }
            options={[
              { value: "private", label: "Private (only me)" },
              { value: "friends", label: "Close friends" },
              { value: "public", label: "Public" },
            ]}
          />
        </label>
        <SubmitRow
          disabled={pending}
          pending={pending}
          label="Save visibility"
          pendingLabel="Saving..."
          done={status === "saved" ? "Saved." : null}
          error={error}
        />
      </form>
    </Card>
  );
}

export function NotificationsSection({
  initial,
}: {
  initial: {
    categories: Record<string, boolean>;
    quietHours: { start: string; end: string } | null;
  };
}) {
  const [categories, setCategories] = useState(initial.categories);
  const [quietOn, setQuietOn] = useState(Boolean(initial.quietHours));
  const [start, setStart] = useState(initial.quietHours?.start ?? "22:00");
  const [end, setEnd] = useState(initial.quietHours?.end ?? "07:00");
  const [status, setStatus] = useState<"saved" | null>(null);
  const { run, pending, error } = useSetNotificationPrefs();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    const saved = await run({ categories, quietHours: quietOn ? { start, end } : null });
    if (saved) setStatus("saved");
  }

  return (
    <Card title="Notifications">
      <form onSubmit={(e) => void save(e)} className="cap-stack">
        <div className="cap-stack" data-gap="4">
          {Object.keys(NOTIFICATION_LABELS).map((cat) => (
            <ToggleRow
              key={cat}
              checked={categories[cat] ?? false}
              onChange={(on) => setCategories((c) => ({ ...c, [cat]: on }))}
              label={NOTIFICATION_LABELS[cat].label}
            />
          ))}
        </div>
        <ToggleRow checked={quietOn} onChange={setQuietOn} label="Quiet hours" />
        {quietOn ? (
          <div className="cap-cluster" data-gap="4">
            <label
              className="cap-stack cap-text"
              data-gap="2"
              data-size="small"
              data-tone="muted"
              data-face="ui"
            >
              From
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass}
              />
            </label>
            <label
              className="cap-stack cap-text"
              data-gap="2"
              data-size="small"
              data-tone="muted"
              data-face="ui"
            >
              To
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        ) : null}
        <SubmitRow
          disabled={pending}
          pending={pending}
          label="Save notifications"
          pendingLabel="Saving..."
          done={status === "saved" ? "Saved." : null}
          error={error}
        />
      </form>
    </Card>
  );
}

export function AppearanceSection() {
  return (
    <Card title="Appearance">
      <div className="cap-spread" data-gap="5" data-align="center">
        <div className="fx-preference-sections-stack">
          <span
            className="cap-text"
            data-size="small"
            data-tone="ink"
            data-weight="strong"
            data-face="ui"
          >
            Theme
          </span>
        </div>
        <ThemeSwitch prefKey={THEME_PREF_KEY} />
      </div>
    </Card>
  );
}

/** Lists and removes close friends; removing one patches this list in place. */
export function CloseFriendsSection({ people }: { people: PeoplePage }) {
  const friends = usePeople(people).data.closeFriends;
  return (
    <Card title="Close friends">
      {friends.length === 0 ? (
        <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
          No close friends yet.
        </p>
      ) : (
        <ul className="fx-preference-sections-stack-2">
          {friends.map((f) => (
            <li key={f.id} className="py-2 fx-preference-sections-card">
              <Link to={`/u/${f.username}`} className="fx-preference-sections-link-2">
                <Avatar src={f.avatarUrl} name={f.displayName ?? f.username} size="sm" />
                <span className="cap-shrink">
                  <span className="cap-clamp block fx-preference-sections-label-2" data-lines="1">
                    {f.displayName ?? f.username}
                  </span>
                  <span className="cap-clamp block fx-preference-sections-label-3" data-lines="1">
                    @{f.username}
                  </span>
                </span>
              </Link>
              <CloseFriendToggle userId={f.id} isClose />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
