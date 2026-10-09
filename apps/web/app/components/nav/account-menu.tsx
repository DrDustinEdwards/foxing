// Signed-in account menu: identity + tier badge, real stats (from the root loader's
// navUser), grouped links, and a compact icon footer bar. Dense single-line rows with
// subtle dividers, matching the legacy dropdown (no scroll). Icons are inline SVG (web
// uses no icon library, Rule 10).
import { type ReactElement, useRef, useState } from "react";
import { Link } from "react-router";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import type { NavUser } from "~/lib/nav.server";
import { Avatar } from "../ui";
import { useDismiss, useRovingMenu } from "./use-menu";

// Inline icon paths (16px, stroke currentColor). One <svg> chrome, per-name path data.
const ICONS: Record<string, ReactElement> = {
  stats: <path d="M5 20V11M12 20V5M19 20v-6" />,
  goals: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  year: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </>
  ),
  vocabulary: (
    <>
      <path d="M12 7c-1.6-1-4-1.6-7-1.3V18c3-.3 5.4.3 7 1.3 1.6-1 4-1.6 7-1.3V5.7c-3-.3-5.4.3-7 1.3z" />
      <path d="M12 7v12.3" />
    </>
  ),
  collections: (
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  ),
  findnext: (
    <>
      <path d="M11 4l1.5 4L16.5 9.5 12.5 11 11 15l-1.5-4L5.5 9.5 9.5 8z" />
      <path d="M17.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  admin: <path d="M12 3.5l7 2.8v4.7c0 4.3-2.9 7.2-7 8.5-4.1-1.3-7-4.2-7-8.5V6.3z" />,
  signout: (
    <>
      <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

// Reading surfaces. The secondary bar holds the primary four (Home, Library, Feed,
// People); notifications have the header bell. Collections is one compact row whose
// sublinks reach the real routes (buddy reads + saved are cut).
const READING_LINKS = [
  { to: "/stats", label: "Stats", icon: "stats" as const },
  { to: "/goals", label: "Goals", icon: "goals" as const },
  { to: "/year", label: "Year in reading", icon: "year" as const },
];
const COLLECTION_LINKS = [
  { to: "/lists", label: "Lists" },
  { to: "/diary", label: "Diary" },
  { to: "/highlights", label: "Highlights" },
  { to: "/commonplace", label: "Commonplace" },
];

function MenuLink({
  to,
  label,
  sublabel,
  icon,
  onNavigate,
}: {
  to: string;
  label: string;
  sublabel?: string;
  icon: keyof typeof ICONS;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className="group flex items-center gap-2.5 px-4 py-1.5 transition-colors hover:bg-hover"
    >
      <span className="shrink-0 text-tertiary transition-colors group-hover:text-brand-text">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-ui text-sm text-secondary transition-colors group-hover:text-brand-text">
          {label}
        </span>
        {sublabel ? <span className="block font-ui text-xs text-tertiary">{sublabel}</span> : null}
      </span>
    </Link>
  );
}

// One dense Collections row: label plus an inline list of the real collection routes.
function CollectionsRow({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-1.5">
      <span className="mt-0.5 shrink-0 text-tertiary">
        <Icon name="collections" />
      </span>
      <div className="min-w-0">
        <span className="block font-ui text-sm text-secondary">Collections</span>
        <span className="flex flex-wrap items-center gap-x-1.5 font-ui text-xs text-tertiary">
          {COLLECTION_LINKS.map((l, i) => (
            <span key={l.to} className="inline-flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              <Link
                to={l.to}
                role="menuitem"
                onClick={onNavigate}
                className="transition-colors hover:text-brand-text"
              >
                {l.label}
              </Link>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

// Compact footer action: icon above a small label, in a divided 3-up bar.
function FooterAction({
  icon,
  label,
  to,
  onClick,
  danger,
  disabled,
}: {
  icon: keyof typeof ICONS;
  label: string;
  to?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const cls =
    "group flex flex-col items-center gap-1 py-2.5 transition-colors hover:bg-hover disabled:opacity-50";
  const tint = danger ? "group-hover:text-error" : "group-hover:text-brand-text";
  const inner = (
    <>
      <span className={cn("text-tertiary transition-colors", tint)}>
        <Icon name={icon} />
      </span>
      <span
        className={cn(
          "font-mono text-[0.6rem] uppercase tracking-[0.06em] text-tertiary transition-colors",
          tint,
        )}
      >
        {label}
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} role="menuitem" onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

function TierBadge({ tier }: { tier: "free" | "plus" }) {
  const isPlus = tier === "plus";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em]",
        isPlus
          ? "bg-brand-subtle text-brand-subtle-text"
          : "border border-border-subtle text-tertiary",
      )}
    >
      {isPlus ? "Plus" : "Free"}
    </span>
  );
}

export function AccountMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  useRovingMenu(ref, open);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    // Full navigation so the root loader re-runs anonymous and the shell resets.
    window.location.assign("/");
  }

  const stats = [
    { label: "books this year", value: user.stats.booksThisYear },
    { label: "day streak", value: user.stats.dayStreak },
    { label: "highlights", value: user.stats.highlights },
  ];
  const close = () => setOpen(false);
  const vocab =
    user.vocabularyToMaster > 0
      ? `${user.vocabularyToMaster} ${user.vocabularyToMaster === 1 ? "word" : "words"} to master`
      : undefined;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.displayName}`}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-interactive focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      >
        <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-hero border border-border-subtle bg-surface shadow-card-md"
        >
          <div className="flex items-center gap-3 border-b border-border-subtle bg-sunken px-4 py-3">
            <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-ui text-sm font-medium text-primary">
                <span className="truncate">{user.displayName}</span>
                <TierBadge tier={user.subscriptionTier} />
              </p>
              <p className="truncate font-mono text-xs text-tertiary">@{user.username}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle text-center">
            {stats.map((stat) => (
              <div key={stat.label} className="px-2 py-2.5">
                <dd className="font-display text-xl text-primary">{stat.value}</dd>
                <dt className="mt-0.5 font-mono text-[0.55rem] uppercase leading-tight tracking-[0.04em] text-tertiary">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>

          <div className="py-1">
            {READING_LINKS.map((l) => (
              <MenuLink key={l.to} to={l.to} label={l.label} icon={l.icon} onNavigate={close} />
            ))}
            <MenuLink
              to="/vocabulary"
              label="Vocabulary"
              sublabel={vocab}
              icon="vocabulary"
              onNavigate={close}
            />
          </div>

          <div className="border-t border-border-subtle py-1">
            <CollectionsRow onNavigate={close} />
          </div>

          <div className="border-t border-border-subtle py-1">
            <MenuLink
              to="/find-next-book"
              label="Find next book"
              sublabel="AI recommendations for you"
              icon="findnext"
              onNavigate={close}
            />
            {user.isAdmin ? (
              <MenuLink to="/admin" label="Admin dashboard" icon="admin" onNavigate={close} />
            ) : null}
          </div>

          <div className="grid grid-cols-3 divide-x divide-border-subtle border-t border-border-subtle">
            <FooterAction
              icon="profile"
              label="Profile"
              to={`/u/${user.username}`}
              onClick={close}
            />
            <FooterAction icon="settings" label="Settings" to="/settings" onClick={close} />
            <FooterAction
              icon="signout"
              label={signingOut ? "..." : "Sign out"}
              onClick={signOut}
              danger
              disabled={signingOut}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
