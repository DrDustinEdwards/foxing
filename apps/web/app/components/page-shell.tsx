import {
  type HeaderExtra,
  type HeaderSection,
  type LinkProps,
  SiteHeader,
  SiteTabs,
} from "capsomer/react/site-header";
import { useState } from "react";
import { useLocation, useRouteLoaderData } from "react-router";
import { Link } from "capsomer/react/link";
import { authClient } from "~/lib/auth-client";
import type { loader as RootLoader } from "~/root";
import { CommandPalette } from "./command-palette";
import { headerAccount } from "./nav/account-panel";
import { BooksPanel, booksGroups, PicksPanel, picksGroups } from "./nav/header-panels";
import { Container } from "./ui";

/** Where Capsomer's theme button remembers the choice; root.tsx's no-flash script reads it. */
export const THEME_PREF_KEY = "foxing-theme";

// The signed-in reader's own pages: a line of tabs under the header on a desktop, Capsomer's
// bottom bar on a phone. Clubs sits in the header's sections; the rest of the personal pages
// (goals, lists, stats, year) are in the account panel.
const YOUR_FOXING = [
  { href: "/home", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/diary", label: "Diary" },
  { href: "/feed", label: "Feed" },
  { href: "/people", label: "People" },
];

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Capsomer's links as React Router's. */
function renderLink({ href, children, ...rest }: LinkProps) {
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);
// No count on the bell: there is no unread-count source yet, and a fake badge is worse than none.
const BELL_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

function YourFoxingBar({ pathname }: { pathname: string }) {
  return (
    <div className="fx-your-bar">
      <Container>
        <nav className="cap-tabs-list" data-variant="line" data-size="sm" aria-label="Your Foxing">
          {YOUR_FOXING.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="cap-tab"
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </div>
  );
}

function SiteNav() {
  const data = useRouteLoaderData<typeof RootLoader>("root");
  const user = data?.navUser ?? null;
  const menu = data?.navMenu ?? { featuredClubs: [], botm: null };
  const { pathname } = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    // Full navigation so the root loader re-runs anonymous and the shell resets.
    window.location.assign("/");
  }

  const sections: HeaderSection[] = [
    {
      id: "books",
      label: "Books",
      current: isCurrent(pathname, "/books") || isCurrent(pathname, "/awards"),
      groups: booksGroups,
      panel: <BooksPanel />,
    },
    {
      id: "picks",
      label: "Celebrity Picks",
      current: isCurrent(pathname, "/picks") || isCurrent(pathname, "/book-of-the-month"),
      groups: picksGroups(menu.featuredClubs, menu.botm),
      panel: <PicksPanel featuredClubs={menu.featuredClubs} botm={menu.botm} />,
    },
    ...[
      { id: "clubs", href: "/clubs", label: "Clubs" },
      { id: "people", href: "/people", label: "People" },
      { id: "journal", href: "/journal", label: "Journal" },
    ].map((s) => ({ ...s, current: isCurrent(pathname, s.href) })),
  ];

  const extras: HeaderExtra[] = [
    {
      id: "search",
      label: "Search the catalog",
      icon: SEARCH_ICON,
      keys: "Ctrl K",
      onClick: () => window.dispatchEvent(new CustomEvent("foxing:search-open")),
    },
    user
      ? { id: "notifications", label: "Notifications", icon: BELL_ICON, href: "/notifications" }
      : { id: "join", label: "Join free", kind: "button", href: "/signup" },
  ];

  return (
    <>
      <SiteHeader
        logo={{
          href: user ? "/home" : "/",
          label: "Foxing",
          // The fox is allowed in nav and footer chrome (Rule 9).
          mark: (
            <span className="fx-logo-mark" aria-hidden="true">
              🦊
            </span>
          ),
          wordmark: (
            <span className="fx-wordmark" aria-hidden="true">
              Foxing
            </span>
          ),
        }}
        links="center"
        translucent
        sections={sections}
        extras={extras}
        themePrefKey={THEME_PREF_KEY}
        account={user ? headerAccount(user, signingOut, signOut) : undefined}
        signIn={user ? undefined : { href: "/login" }}
        skipTo="#main"
        renderLink={renderLink}
      />
      {user ? <YourFoxingBar pathname={pathname} /> : null}
      <CommandPalette />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="fx-footer">
      <Container className="fx-footer-cols">
        <div className="fx-footer-brand">
          <Link to="/" className="fx-footer-mark">
            <span aria-hidden="true">🦊</span>
            <span>Foxing</span>
          </Link>
          <p className="fx-footer-motto">reading, together.</p>
          <p className="mt-3 measure-xs small dim">
            A reading home for the classics and the conversations around them.
          </p>
          <Link to="/about" className="fx-footer-link mt-3 block">
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
            { to: "/lists", label: "Reading lists" },
          ]}
        />
        <FooterCol
          title="Using Foxing"
          links={[
            { to: "/features", label: "What Foxing does" },
            { to: "/guide", label: "Web guide" },
            { to: "/app-guide", label: "App guide" },
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
      <Container className="fx-footer-base">
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
      <p className="group-label">{title}</p>
      <ul className="stack-2 mt-3">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="fx-footer-link">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full page frame: Capsomer's header (with its skip link), the main landmark, the footer, and
 *  for a signed-in reader Capsomer's bottom bar on a phone, last so it sticks to the bottom. */
export function PageShell({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof RootLoader>("root");
  const signedIn = Boolean(data?.navUser);
  const { pathname } = useLocation();
  return (
    <>
      <SiteNav />
      <main id="main" className="fx-main">
        {children}
      </main>
      <SiteFooter />
      {signedIn ? (
        <SiteTabs
          label="Your Foxing"
          renderLink={renderLink}
          tabs={YOUR_FOXING.map((t) => ({ ...t, current: isCurrent(pathname, t.href) }))}
        />
      ) : null}
    </>
  );
}
