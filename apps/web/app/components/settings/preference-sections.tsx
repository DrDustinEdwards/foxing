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
import { ThemeSwitch } from "capsomer/react/theme-switch";
import { THEME_PREF_KEY } from "~/components/page-shell";
import { Link } from "capsomer/react/link";
import { Avatar } from "~/components/ui";
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
  onUpgrade: () => void;
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
      {isPlus ? (
        <div className="stack-3">
          <p className="ui">
            You are on <span className="strong">Foxing Plus</span>
            {status ? ` (${status})` : ""}.{periodEndLabel ? ` Renews ${periodEndLabel}.` : ""}
          </p>
          <button type="button" onClick={manage} disabled={pending} className="cap-btn">
            {pending ? "Opening..." : "Manage billing"}
          </button>
        </div>
      ) : (
        <div className="stack-3">
          <p className="ui">
            You are on the <span className="strong">Free</span> plan. Clubs and the whole social
            layer are free. Plus adds the AI reading companion.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="cap-btn self-start"
            data-variant="primary"
          >
            Upgrade to Plus
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-3 error" role="alert">
          {error}
        </p>
      ) : null}
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
      <form onSubmit={save} className="stack">
        <ToggleRow
          checked={profile === "public"}
          onChange={(on) => setProfile(on ? "public" : "private")}
          label="Public profile"
          subtext="Let other readers find your profile, library, and reviews. When off, only you can see it."
        />
        <ToggleRow
          checked={progress === "public"}
          onChange={(on) => setProgress(on ? "public" : "private")}
          label="Share reading progress"
          subtext="Show what you are currently reading on your profile."
        />
        <label className="block">
          <span className="fx-label">Default highlight and note audience</span>
          <select
            value={defaultAnnotation}
            onChange={(e) =>
              setDefaultAnnotation(e.target.value as VisibilityValues["defaultAnnotation"])
            }
            className={inputClass}
          >
            <option value="private">Private (only me)</option>
            <option value="friends">Close friends</option>
            <option value="public">Public</option>
          </select>
          <span className="mt-1 block fx-preference-sections-label">
            New highlights and notes start with this audience. You can change any one when you make
            it.
          </span>
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
      <form onSubmit={save} className="stack">
        <p className="ui">
          Choose which push notifications the mobile app sends you. Quiet hours pause them overnight
          in your timezone.
        </p>
        <div className="stack-3">
          {Object.keys(NOTIFICATION_LABELS).map((cat) => (
            <ToggleRow
              key={cat}
              checked={categories[cat] ?? false}
              onChange={(on) => setCategories((c) => ({ ...c, [cat]: on }))}
              label={NOTIFICATION_LABELS[cat].label}
              subtext={NOTIFICATION_LABELS[cat].subtext}
            />
          ))}
        </div>
        <ToggleRow
          checked={quietOn}
          onChange={setQuietOn}
          label="Quiet hours"
          subtext="Pause notifications between these times."
        />
        {quietOn ? (
          <div className="row">
            <label className="ui">
              From
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="ui">
              To
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={`${inputClass} mt-1`}
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
      <div className="row-4 spread">
        <div className="fx-preference-sections-stack">
          <span className="sans small strong">Theme</span>
          <span className="fine">
            Switch between light and dark. Your choice is remembered on this device.
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
      <p className="ui">
        Close friends see your friends-only reviews, activity, and shared annotations.
      </p>
      {friends.length === 0 ? (
        <p className="mt-4 meta">
          No close friends yet. Add readers you follow from{" "}
          <Link to="/people" className="fx-preference-sections-link">
            People
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 fx-preference-sections-stack-2">
          {friends.map((f) => (
            <li key={f.id} className="py-2 fx-preference-sections-card">
              <Link to={`/u/${f.username}`} className="fx-preference-sections-link-2">
                <Avatar src={f.avatarUrl} name={f.displayName ?? f.username} size="sm" />
                <span className="min-0">
                  <span className="block truncate fx-preference-sections-label-2">
                    {f.displayName ?? f.username}
                  </span>
                  <span className="block truncate fx-preference-sections-label-3">
                    @{f.username}
                  </span>
                </span>
              </Link>
              <CloseFriendToggle userId={f.id} isClose />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 meta">
        Add close friends from{" "}
        <Link to="/people" className="fx-preference-sections-link">
          People
        </Link>
        , where you can pick from the readers you follow.
      </p>
    </Card>
  );
}
