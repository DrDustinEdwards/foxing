// Admin chrome: the site PageShell plus an operator sidebar. Every admin page renders
// inside <AdminShell current="...">. Sections match the launch-critical set; cut legacy
// sections (author-claims, giveaways, bookstores, 404s, mcp) are intentionally absent.
import { NavLink } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";

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
    <nav aria-label="Admin sections" className="fx-admin-shell-nav">
      <p className="mb-2 group-label">Admin</p>
      <ul className="fx-admin-shell-row">
        {ADMIN_SECTIONS.map((s) => (
          <li key={s.to}>
            <NavLink to={s.to} end={"end" in s ? s.end : false} className="fx-admin-nav-link">
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
        <div className="fx-admin-shell-grid">
          <AdminSidebar />
          <div className="min-0">{children}</div>
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
    <section className="fx-admin-shell-card">
      {title || action ? (
        <div className="mb-4 row-4 spread">
          {title ? <h2 className="display-1">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
