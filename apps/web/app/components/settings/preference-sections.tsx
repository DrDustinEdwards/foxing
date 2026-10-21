import { useState } from "react";
import { Card, inputClass, ToggleRow } from "./settings-card";
import { ThemeToggle } from "~/components/theme-toggle";
import { Link } from "react-router";
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPlus = tier === "plus";

  async function manage() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (res.ok && body?.url) {
        window.location.assign(body.url);
        return;
      }
      setError(body?.error?.message ?? `Could not open billing (${res.status}).`);
    } catch {
      setError("Could not reach billing. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Plan">
      {isPlus ? (
        <div className="space-y-3">
          <p className="font-ui text-sm text-secondary">
            You are on <span className="font-medium text-primary">Foxing Plus</span>
            {status ? ` (${status})` : ""}.{periodEndLabel ? ` Renews ${periodEndLabel}.` : ""}
          </p>
          <button
            type="button"
            onClick={manage}
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Opening..." : "Manage billing"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-ui text-sm text-secondary">
            You are on the <span className="font-medium text-primary">Free</span> plan. Clubs and
            the whole social layer are free. Plus adds the AI reading companion.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-md bg-brand-ui px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:opacity-90"
          >
            Upgrade to Plus
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-3 font-ui text-sm text-error" role="alert">
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
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, progress, defaultAnnotation }),
      });
      if (!res.ok) {
        setError("Could not save your visibility settings. Try again.");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Could not save your settings. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Visibility">
      <form onSubmit={save} className="space-y-4">
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
          <span className="mb-1 block font-ui text-sm text-secondary">
            Default highlight and note audience
          </span>
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
          <span className="mt-1 block font-ui text-xs text-tertiary">
            New highlights and notes start with this audience. You can change any one when you make
            it.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save visibility"}
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

const NOTIFICATION_LABELS: Record<string, { label: string; subtext: string }> = {
  streak: { label: "Reading streak reminders", subtext: "A nudge when your streak is at risk." },
  club_replies: { label: "Club replies", subtext: "When someone replies to you in a club." },
  meetings: { label: "Club meetings", subtext: "Reminders before a club meeting." },
  announcements: { label: "Foxing announcements", subtext: "Occasional product news." },
  follows: { label: "New followers", subtext: "When a reader follows you." },
  reactions: { label: "Reactions", subtext: "When someone reacts to your activity." },
  club_activity: { label: "Club activity", subtext: "New posts and polls in your clubs." },
  club_admin: { label: "Club admin", subtext: "Role changes and approvals in clubs you run." },
  milestones: { label: "Reading milestones", subtext: "When you hit a reading milestone." },
};

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
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          quietHours: quietOn ? { start, end } : null,
        }),
      });
      if (!res.ok) {
        setError("Could not save your notification settings. Try again.");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Could not save your settings. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Notifications">
      <form onSubmit={save} className="space-y-4">
        <p className="font-ui text-sm text-secondary">
          Choose which push notifications the mobile app sends you. Quiet hours pause them overnight
          in your timezone.
        </p>
        <div className="space-y-3">
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
          <div className="flex items-center gap-3">
            <label className="font-ui text-sm text-secondary">
              From
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="font-ui text-sm text-secondary">
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
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save notifications"}
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

export function AppearanceSection() {
  return (
    <Card title="Appearance">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-ui text-sm font-medium text-primary">Theme</span>
          <span className="font-ui text-xs text-tertiary">
            Switch between light and dark. Your choice is remembered on this device.
          </span>
        </div>
        <ThemeToggle />
      </div>
    </Card>
  );
}

export function CloseFriendsSection({
  friends,
}: {
  friends: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>;
}) {
  return (
    <Card title="Close friends">
      <p className="font-ui text-sm text-secondary">
        Close friends see your friends-only reviews, activity, and shared annotations.
      </p>
      {friends.length === 0 ? (
        <p className="mt-4 font-ui text-sm text-tertiary">
          No close friends yet. Add readers you follow from{" "}
          <Link to="/people" className="text-brand-text underline underline-offset-2">
            People
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {friends.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-base px-3 py-2"
            >
              <Link to={`/u/${f.username}`} className="flex min-w-0 items-center gap-3">
                <Avatar src={f.avatarUrl} name={f.displayName} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-ui text-sm font-medium text-primary">
                    {f.displayName}
                  </span>
                  <span className="block truncate font-mono text-xs text-tertiary">
                    @{f.username}
                  </span>
                </span>
              </Link>
              <CloseFriendToggle userId={f.id} initialClose />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 font-ui text-sm text-tertiary">
        Add close friends from{" "}
        <Link to="/people" className="text-brand-text underline underline-offset-2">
          People
        </Link>
        , where you can pick from the readers you follow.
      </p>
    </Card>
  );
}
