// Signed-in account menu: identity, real stats (from the root loader's navUser), and
// the account links. Extracted from page-shell so later slices reuse it unchanged.
import { useRef, useState } from "react";
import { Link } from "react-router";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import type { NavUser } from "~/lib/nav.server";
import { Avatar } from "../ui";
import { useDismiss, useRovingMenu } from "./use-menu";

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
              <p className="truncate font-ui text-sm font-medium text-primary">
                {user.displayName}
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
            <Link
              to="/library"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
            >
              Your library
            </Link>
            <Link
              to="/me"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
            >
              Profile
            </Link>
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
            >
              Settings
            </Link>
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
