import { Link, NavLink, useRouteLoaderData } from "react-router";
import { cn } from "~/lib/cn";
import type { loader as RootLoader } from "~/root";
import { CommandPalette } from "./command-palette";
import { AccountMenu } from "./nav/account-menu";
import { BooksMenu } from "./nav/books-menu";
import { ThemeToggle } from "./theme-toggle";
import { Container } from "./ui";

// Public catalog links shown to everyone. "Books" opens a dropdown (BooksMenu); the
// rest are plain links. Home/Library are signed-in only and live in the secondary bar.
const PRIMARY_LINKS = [
  { to: "/awards", label: "Awards" },
  { to: "/picks", label: "Celebrity Picks" },
  { to: "/book-of-the-month", label: "Book of the Month" },
  { to: "/journal", label: "Journal" },
];

// Signed-in app bar. Only routes that exist today; later slices (Feed, Diary, People)
// append entries here.
const SECONDARY_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/library", label: "Library" },
  { to: "/clubs", label: "Clubs" },
];

function Wordmark({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-display text-xl font-semibold">
      {/* Fox emoji is allowed in nav/footer chrome (Rule 9). */}
      <span aria-hidden="true">🦊</span>
      <span>Foxing</span>
    </Link>
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
          <button
            type="button"
            aria-label="Search the catalog"
            title="Search (Ctrl+K)"
            onClick={() => window.dispatchEvent(new CustomEvent("foxing:search-open"))}
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
          </button>
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
      <CommandPalette />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border-subtle bg-sunken">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Wordmark to="/" />
          <p className="mt-2 font-body text-base italic text-tertiary">reading, together.</p>
          <p className="mt-3 max-w-xs text-sm text-tertiary">
            A reading home for the classics and the conversations around them.
          </p>
          <Link
            to="/about"
            className="mt-3 inline-block font-ui text-sm text-secondary hover:text-brand-text"
          >
            About
          </Link>
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
