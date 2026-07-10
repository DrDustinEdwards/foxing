import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useRouteLoaderData } from "react-router";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import type { NavUser } from "~/lib/nav.server";
import type { loader as RootLoader } from "~/root";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, Container } from "./ui";

// Public catalog links shown to everyone. "Books" opens a dropdown (BooksMenu); the
// rest are plain links. Home/Library are signed-in only and live in the secondary bar.
const PRIMARY_LINKS = [
  { to: "/awards", label: "Awards" },
  { to: "/picks", label: "Celebrity Picks" },
  { to: "/book-of-the-month", label: "Book of the Month" },
  { to: "/journal", label: "Journal" },
];

// Books dropdown. Browse items are real routes; era chips map to /books?era= filters
// that ship today (genre/era/length; mood is null in data, so omitted). The era list
// mirrors core ERA_BUCKETS (facets.ts), kept local so the client bundle does not pull
// in the core query layer.
const BOOKS_BROWSE = [
  { to: "/books", label: "All books" },
  { to: "/awards", label: "Award winners" },
  { to: "/book-of-the-month", label: "Book of the Month" },
  { to: "/picks", label: "Celebrity picks" },
];
const BOOKS_ERAS = [
  { slug: "pre-1800", label: "Before 1800" },
  { slug: "1800-1849", label: "1800 to 1849" },
  { slug: "1850-1899", label: "1850 to 1899" },
  { slug: "1900-1949", label: "1900 to 1949" },
  { slug: "modern", label: "1950 and later" },
];

// Signed-in app bar. Only routes that exist today; later slices (Feed, Diary, Clubs,
// People) append entries here.
const SECONDARY_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/library", label: "Library" },
];

/** Dismiss an open menu on outside pointerdown or Escape. */
function useDismiss(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

function Wordmark({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 font-display text-xl font-semibold"
    >
      {/* Fox emoji is allowed in nav/footer chrome (Rule 9). */}
      <span aria-hidden="true">🦊</span>
      <span>Foxing</span>
    </Link>
  );
}

function BooksMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-ui text-sm transition-colors",
          open ? "bg-brand-subtle text-brand-subtle-text" : "text-secondary hover:bg-hover",
        )}
      >
        Books
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Books"
          className="absolute left-0 top-11 z-50 w-[26rem] rounded-hero border border-border-subtle bg-surface p-5 shadow-card-md"
        >
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Browse
              </p>
              <ul className="space-y-0.5">
                {BOOKS_BROWSE.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2 py-1.5 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                By era
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BOOKS_ERAS.map((era) => (
                  <Link
                    key={era.slug}
                    to={`/books?era=${era.slug}`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="inline-flex rounded-full bg-brand-subtle px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text transition-colors hover:bg-selected"
                  >
                    {era.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

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
              <p className="truncate font-ui text-sm font-medium text-primary">{user.displayName}</p>
              <p className="truncate font-mono text-xs text-tertiary">@{user.username}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 border-b border-border-subtle text-center">
            {stats.map((stat, i) => (
              <div key={stat.label} className={cn("px-2 py-3", i > 0 && "border-l border-border-subtle")}>
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

function SignedOutActions() {
  return (
    <>
      <Link
        to="/login"
        className="hidden rounded-cover px-3 py-2 font-ui text-sm font-medium text-secondary transition-colors hover:text-primary sm:inline-flex"
      >
        Sign in
      </Link>
      <Link
        to="/signup"
        className="rounded-cover bg-brand-text px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover dark:text-[color:var(--section-charcoal)]"
      >
        Join free
      </Link>
    </>
  );
}

function SecondaryAuthBar() {
  return (
    <nav aria-label="Your Foxing" className="border-t border-border-subtle bg-sunken">
      <Container className="flex h-11 items-center gap-1 overflow-x-auto">
        {SECONDARY_LINKS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "inline-flex h-7 items-center whitespace-nowrap rounded-md px-3 font-ui text-xs transition-colors",
                isActive
                  ? "bg-brand-subtle text-brand-subtle-text"
                  : "text-tertiary hover:text-primary",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </Container>
    </nav>
  );
}

export function SiteNav() {
  const data = useRouteLoaderData<typeof RootLoader>("root");
  const user = data?.navUser ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-base/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark to={user ? "/home" : "/"} />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <BooksMenu />
          {PRIMARY_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-3 py-1.5 font-ui text-sm transition-colors",
                  isActive
                    ? "bg-brand-subtle text-brand-subtle-text"
                    : "text-secondary hover:bg-hover",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/search"
            aria-label="Search the catalog"
            className="grid h-9 w-9 place-items-center rounded-full border border-border-subtle text-secondary transition-colors hover:bg-hover"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="m20 20-3.2-3.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </Link>
          <ThemeToggle />
          {user ? <AccountMenu user={user} /> : <SignedOutActions />}
        </div>
      </Container>
      {/* Compact primary nav for small screens. Books is a plain link here. */}
      <nav
        aria-label="Primary (compact)"
        className="flex gap-1 overflow-x-auto border-t border-border-subtle px-4 py-2 md:hidden"
      >
        <NavLink
          to="/books"
          className={({ isActive }) =>
            cn(
              "whitespace-nowrap rounded-full px-3 py-1 font-ui text-sm",
              isActive ? "bg-brand-subtle text-brand-subtle-text" : "text-secondary",
            )
          }
        >
          Books
        </NavLink>
        {PRIMARY_LINKS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "whitespace-nowrap rounded-full px-3 py-1 font-ui text-sm",
                isActive ? "bg-brand-subtle text-brand-subtle-text" : "text-secondary",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {user ? <SecondaryAuthBar /> : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border-subtle bg-sunken">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Wordmark to="/" />
          <p className="mt-3 max-w-xs text-sm text-tertiary">
            A reading home for the classics and the conversations around them.
          </p>
        </div>
        <FooterCol
          title="Browse"
          links={[
            { to: "/books", label: "All books" },
            { to: "/awards", label: "Literary awards" },
            { to: "/search", label: "Search" },
          ]}
        />
        <FooterCol
          title="Reading"
          links={[
            { to: "/picks", label: "Celebrity picks" },
            { to: "/book-of-the-month", label: "Book of the Month" },
            { to: "/journal", label: "The Journal" },
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            { to: "/login", label: "Sign in" },
            { to: "/signup", label: "Create account" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { to: "/privacy", label: "Privacy" },
            { to: "/terms", label: "Terms" },
          ]}
        />
      </Container>
      <Container className="flex flex-col gap-2 border-t border-border-subtle py-6 text-xs text-tertiary sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Foxing. Read freely, keep the record.</p>
        <p>
          <span aria-hidden="true">🦊</span> Made for readers.
        </p>
      </Container>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="font-ui text-sm text-secondary hover:text-brand-text">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full page frame: skip link, sticky nav, main landmark, footer. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-cover focus:bg-brand focus:px-4 focus:py-2 focus:font-ui focus:text-sm focus:text-on-brand"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="min-h-[60dvh] py-10">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
