// Mobile slide-in drawer, ported from the legacy nav. Discover/Community sections plus a
// dark-mode toggle and the sign-in/join actions. Every link is gated to a route that
// exists in this build: By Mood is omitted (no /discover route yet).
import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router";
import { cn } from "~/lib/cn";
import { ThemeToggle } from "../theme-toggle";

const DISCOVER_LINKS = [
  { to: "/books", label: "Books" },
  { to: "/awards", label: "Award winners" },
];

const COMMUNITY_LINKS = [
  { to: "/picks", label: "Celebrity Picks" },
  { to: "/book-of-the-month", label: "Book of the Month" },
  { to: "/clubs", label: "Reading Clubs" },
  { to: "/people", label: "People" },
  { to: "/journal", label: "Journal" },
];

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open ? (
        <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-40 bg-black/40" />
      ) : null}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-surface shadow-card-md transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="flex justify-end p-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-md text-secondary transition-colors hover:bg-hover"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <DrawerSection title="Discover" links={DISCOVER_LINKS} onClose={onClose} />
        <DrawerSection title="Community" links={COMMUNITY_LINKS} onClose={onClose} />

        <div className="flex-1" />

        <div className="flex flex-col gap-3 border-t border-border-subtle p-5">
          <div className="flex items-center justify-between gap-3 rounded-md bg-sunken px-3 py-2">
            <span className="font-ui text-sm text-primary">Dark mode</span>
            <ThemeToggle />
          </div>
          <div className="flex gap-2">
            <Link
              to="/login"
              onClick={onClose}
              className="flex-1 rounded-cover border border-border-subtle px-3 py-2 text-center font-ui text-sm font-medium text-secondary transition-colors hover:bg-hover"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              onClick={onClose}
              className="flex-1 rounded-cover bg-brand-text px-3 py-2 text-center font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover dark:text-[color:var(--section-charcoal)]"
            >
              Join free
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerSection({
  title,
  links,
  onClose,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
  onClose: () => void;
}) {
  return (
    <>
      <p className="px-5 pb-2 pt-5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
        {title}
      </p>
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "block px-5 py-3 font-ui text-base transition-colors hover:bg-hover",
                  isActive ? "bg-brand-subtle text-brand-subtle-text" : "text-primary",
                )
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );
}
