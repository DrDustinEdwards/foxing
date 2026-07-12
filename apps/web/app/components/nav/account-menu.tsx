// Signed-in account menu: identity, real stats (from the root loader's navUser), and
// the account links. Extracted from page-shell so later slices reuse it unchanged.
import { useRef, useState } from "react";
import { Link } from "react-router";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import type { NavUser } from "~/lib/nav.server";
import { Avatar } from "../ui";
import { useDismiss, useRovingMenu } from "./use-menu";

// Personal reading surfaces, grouped in the account menu to the legacy structure. The
// secondary bar holds the primary four (Home, Library, Feed, People); notifications have
// their own header bell. Every entry is a real route (buddy reads, saved, and find-next-
// book are cut and do not appear). Vocabulary carries a live "N words to master" line.
const READING_LINKS = [
  { to: "/stats", label: "Reading stats" },
  { to: "/goals", label: "Reading goals" },
  { to: "/year", label: "Year in reading" },
];
const COLLECTION_LINKS = [
  { to: "/lists", label: "Your lists" },
  { to: "/diary", label: "Diary" },
  { to: "/highlights", label: "Highlights" },
  { to: "/commonplace", label: "Commonplace" },
];

function MenuLink({
  to,
  label,
  subtitle,
  onNavigate,
}: {
  to: string;
  label: string;
  subtitle?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center justify-between gap-2 px-4 py-2 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
    >
      <span>{label}</span>
      {subtitle ? <span className="font-mono text-[0.6875rem] text-tertiary">{subtitle}</span> : null}
    </Link>
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
          <dl className="grid grid-cols-3 border-b border-border-subtle text-center">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={cn("px-2 py-3", i > 0 && "border-l border-border-subtle")}
              >
                <dd className="font-display text-xl text-primary">{stat.value}</dd>
                <dt className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-tertiary">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
          <div className="py-1">
            <MenuLink to="/library" label="Your library" onNavigate={() => setOpen(false)} />
            <MenuLink
              to={`/u/${user.username}`}
              label="Profile"
              onNavigate={() => setOpen(false)}
            />
          </div>
          <div className="border-t border-border-subtle py-1">
            {READING_LINKS.map((l) => (
              <MenuLink key={l.to} to={l.to} label={l.label} onNavigate={() => setOpen(false)} />
            ))}
            <MenuLink
              to="/vocabulary"
              label="Vocabulary"
              subtitle={
                user.vocabularyToMaster > 0
                  ? `${user.vocabularyToMaster} ${user.vocabularyToMaster === 1 ? "word" : "words"} to master`
                  : undefined
              }
              onNavigate={() => setOpen(false)}
            />
          </div>
          <div className="border-t border-border-subtle py-1">
            <p className="px-4 pb-1 pt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
              Collections
            </p>
            {COLLECTION_LINKS.map((l) => (
              <MenuLink key={l.to} to={l.to} label={l.label} onNavigate={() => setOpen(false)} />
            ))}
          </div>
          <div className="border-t border-border-subtle py-1">
            <MenuLink to="/settings" label="Settings" onNavigate={() => setOpen(false)} />
            {user.isAdmin ? (
              <MenuLink to="/admin" label="Admin dashboard" onNavigate={() => setOpen(false)} />
            ) : null}
          </div>
          <div className="border-t border-border-subtle py-1">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="block w-full px-4 py-2 text-left font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-error disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
