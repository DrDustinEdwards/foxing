import { Link, NavLink } from "react-router";
import { cn } from "~/lib/cn";
import { ThemeToggle } from "./theme-toggle";
import { Container } from "./ui";

const NAV = [
  { to: "/books", label: "Books" },
  { to: "/library", label: "Library" },
  { to: "/awards", label: "Awards" },
  { to: "/picks", label: "Picks" },
  { to: "/book-of-the-month", label: "Book of the Month" },
  { to: "/journal", label: "Journal" },
];

function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn("flex items-center gap-2 font-display text-xl font-semibold", className)}
    >
      {/* Fox emoji is allowed in nav/footer chrome (Rule 9). */}
      <span aria-hidden="true">🦊</span>
      <span>Foxing</span>
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-base/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
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
          <Link
            to="/login"
            className="hidden rounded-cover bg-brand-text px-4 py-2 font-ui text-sm font-medium text-on-brand transition hover:bg-brand-hover sm:inline-flex dark:text-[color:var(--section-charcoal)]"
          >
            Sign in
          </Link>
        </div>
      </Container>
      {/* Compact nav for small screens. */}
      <nav
        aria-label="Primary (compact)"
        className="flex gap-1 overflow-x-auto border-t border-border-subtle px-4 py-2 md:hidden"
      >
        {NAV.map((item) => (
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
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border-subtle bg-sunken">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Wordmark />
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

/** Full public page frame: skip link, sticky nav, main landmark, footer. */
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
