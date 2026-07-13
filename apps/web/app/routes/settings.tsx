// Account settings (auth-gated, noindex): profile fields, plan, visibility, appearance,
// close friends, password, data export, and account deletion. Every write shows a visible
// pending + role=alert error, never a silent no-op.
import { pushDomain } from "@foxing/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { Avatar } from "~/components/ui";
import { CloseFriendToggle } from "~/components/social/close-friend-toggle";
import { ThemeToggle } from "~/components/theme-toggle";
import { cloudflareContext } from "~/context";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { requireProfile } from "~/lib/profile.server";
import { loadCloseFriends } from "~/lib/social.server";
import { Container, PageHeader } from "~/components/ui";
import type { Route } from "./+types/settings";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user, profile } = await requireProfile(env, request);
  const isPlus = profile.subscriptionTier === "plus";
  const vis = profile.visibility ?? {};
  const closeFriends = await loadCloseFriends(env, user.id);
  // Effective notification prefs: each category's stored override, or its quiet default.
  const notifPrefs = profile.notificationPrefs ?? null;
  const notifications = {
    categories: Object.fromEntries(
      pushDomain.PUSH_CATEGORIES.map((cat) => [cat, pushDomain.categoryEnabled(cat, notifPrefs)]),
    ) as Record<(typeof pushDomain.PUSH_CATEGORIES)[number], boolean>,
    quietHours: notifPrefs?.quietHours ?? null,
  };
  return {
    username: profile.username,
    email: user.email,
    isAdmin: Boolean(profile.isAdmin),
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    favoriteGenres: (profile.favoriteGenres ?? []).join(", "),
    tier: isPlus ? ("plus" as const) : ("free" as const),
    isPlus,
    subscriptionStatus: profile.subscriptionStatus,
    periodEndLabel: profile.subscriptionPeriodEnd
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
          profile.subscriptionPeriodEnd,
        )
      : null,
    visibility: {
      profile: vis.profile === "private" ? ("private" as const) : ("public" as const),
      progress: vis.progress === "private" ? ("private" as const) : ("public" as const),
      defaultAnnotation:
        vis.defaultAnnotation === "friends"
          ? ("friends" as const)
          : vis.defaultAnnotation === "public"
            ? ("public" as const)
            : ("private" as const),
    },
    closeFriends: closeFriends.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName ?? p.username,
      avatarUrl: p.avatarUrl,
    })),
    notifications,
  };
}

export function meta() {
  return [{ title: "Settings | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  return (
    <PageShell>
      <Container className="max-w-2xl">
        <PageHeader eyebrow="Account" title="Settings" />
        <div className="space-y-8">
          <ProfileSection initial={loaderData} />
          <UsernameSection initial={loaderData.username} />
          <EmailSection initial={loaderData.email} />
          <BillingSection
            tier={loaderData.tier}
            status={loaderData.subscriptionStatus}
            periodEndLabel={loaderData.periodEndLabel}
            onUpgrade={() => setPaywallOpen(true)}
          />
          <VisibilitySection initial={loaderData.visibility} />
          <NotificationsSection initial={loaderData.notifications} />
          <AppearanceSection />
          <CloseFriendsSection friends={loaderData.closeFriends} isPlus={loaderData.isPlus} />
          <PasswordSection />
          <DataSection />
          {loaderData.isAdmin ? <AdminSection /> : null}
          <DangerSection />
        </div>
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

function BillingSection({
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

function VisibilitySection({ initial }: { initial: VisibilityValues }) {
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

function ToggleRow({
  checked,
  onChange,
  label,
  subtext,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  subtext: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-base p-3">
      <div className="flex flex-col">
        <span className="font-ui text-sm font-medium text-primary">{label}</span>
        <span className="font-ui text-xs text-tertiary">{subtext}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand-ui" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
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

function NotificationsSection({
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

function AppearanceSection() {
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

function CloseFriendsSection({
  friends,
  isPlus,
}: {
  friends: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>;
  isPlus: boolean;
}) {
  return (
    <Card title="Close friends">
      <p className="font-ui text-sm text-secondary">
        Close friends see your friends-only reviews and activity. Curating this list is part of
        Foxing Plus.
      </p>
      {friends.length === 0 ? (
        <p className="mt-4 font-ui text-sm text-tertiary">
          No close friends yet. Add readers you follow from{" "}
          <Link to="/people" className="text-brand-text hover:underline">
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
              <CloseFriendToggle userId={f.id} initialClose isPlus={isPlus} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 font-ui text-sm text-tertiary">
        Add close friends from{" "}
        <Link to="/people" className="text-brand-text hover:underline">
          People
        </Link>
        , where you can pick from the readers you follow.
      </p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-6">
      <h2 className="font-display text-xl text-primary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputClass =
  "w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary";

// Bio length matches the legacy limit so the counter and the stored value agree.
const BIO_MAX = 200;

function ProfileSection({
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

function UsernameSection({ initial }: { initial: string }) {
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

function EmailSection({ initial }: { initial: string }) {
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

function AdminSection() {
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

function PasswordSection() {
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

function DataSection() {
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

function DangerSection() {
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
