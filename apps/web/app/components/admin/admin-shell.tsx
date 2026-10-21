// Admin chrome: the site PageShell plus an operator sidebar. Every admin page renders
// inside <AdminShell current="...">. Sections match the launch-critical set; cut legacy
// sections (author-claims, giveaways, bookstores, 404s, mcp) are intentionally absent.
import { NavLink } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cn } from "~/lib/cn";

const ADMIN_SECTIONS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/book-of-month", label: "Book of the Month" },
  { to: "/admin/celebrity-picks", label: "Celebrity Picks" },
  { to: "/admin/books", label: "Books" },
  { to: "/admin/clubs", label: "Clubs" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/journal", label: "Journal" },
  { to: "/admin/notifications", label: "Notifications" },
  { to: "/admin/content", label: "Content" },
  { to: "/admin/analytics", label: "Analytics" },
] as const;

function AdminSidebar() {
  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
        Admin
      </p>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ADMIN_SECTIONS.map((s) => (
          <li key={s.to}>
            <NavLink
              to={s.to}
              end={"end" in s ? s.end : false}
              className={({ isActive }) =>
                cn(
                  "block whitespace-nowrap rounded-md px-3 py-2 font-ui text-sm transition-colors",
                  isActive
                    ? "bg-brand-subtle text-brand-subtle-text"
                    : "text-secondary hover:bg-hover hover:text-primary",
                )
              }
            >
              {s.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <Container>
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <AdminSidebar />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </PageShell>
  );
}

/** Section card used across the admin pages. Matches the settings Card look. */
export function AdminCard({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-6">
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title ? <h2 className="font-display text-xl text-primary">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
