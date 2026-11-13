// Admin chrome: Capsomer's admin shell (header, app strip, section menu, top bar) with Foxing's
// sections; every admin page renders inside <AdminShell>. Cut legacy sections (author-claims,
// giveaways, bookstores, 404s, mcp) are intentionally absent.
import {
  AdminShell as CapsomerAdminShell,
  FIRST_PAGE,
  type AdminEntry,
} from "capsomer/react/admin-shell";
import {
  Icon,
  iconAward,
  iconBell,
  iconBook,
  iconDocument,
  iconOverview,
  iconPeople,
  iconRoles,
  iconStar,
  iconStats,
} from "capsomer/react/icons";
import { routerRenderLink } from "capsomer/react/link";
import { useLocation, useRouteLoaderData } from "react-router";
import { avatarInitials } from "~/components/ui";
import { THEME_PREF_KEY } from "~/lib/theme";
// The shell's styles load only in the admin (React 19 hoists the link).
import adminShellCss from "capsomer/admin-shell.css?url";
import type { loader as RootLoader } from "~/root";

const entry = (href: string, label: string, icon: string, group: string): AdminEntry => ({
  id: href,
  label,
  href,
  group,
  icon: <Icon d={icon} className="cap-admin-icon" />,
});

const ADMIN_SECTIONS: AdminEntry[] = [
  entry("/admin", FIRST_PAGE, iconOverview, "Watch"),
  entry("/admin/analytics", "Analytics", iconStats, "Watch"),
  entry("/admin/book-of-month", "Book of the Month", iconStar, "Catalog"),
  entry("/admin/celebrity-picks", "Celebrity Picks", iconAward, "Catalog"),
  entry("/admin/books", "Books", iconBook, "Catalog"),
  entry("/admin/content", "Content", iconDocument, "Catalog"),
  entry("/admin/users", "Users", iconPeople, "Readers"),
  entry("/admin/clubs", "Clubs", iconRoles, "Readers"),
  entry("/admin/notifications", "Notifications", iconBell, "Readers"),
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const user = useRouteLoaderData<typeof RootLoader>("root")?.navUser ?? null;
  const { pathname } = useLocation();
  return (
    <CapsomerAdminShell
      app="foxing"
      nav={ADMIN_SECTIONS}
      pathname={pathname}
      documentTitle={false}
      renderLink={routerRenderLink}
      themePrefKey={THEME_PREF_KEY}
      viewSite="/home"
      account={{
        name: user?.displayName ?? "Admin",
        initials: avatarInitials(user?.displayName ?? "Admin"),
        avatar: user?.avatarUrl ?? undefined,
        role: "Admin",
        onSignOut: () => void import("~/lib/auth-client").then((m) => m.signOutToHome()),
      }}
      prefKey="foxing-admin-rail"
    >
      <link rel="stylesheet" href={adminShellCss} precedence="default" />
      <div className="cap-admin-page">{children}</div>
    </CapsomerAdminShell>
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
    <section className="cap-card">
      {title || action ? (
        <div className="cap-spread" data-gap="5" data-align="center">
          {title ? <h2 className="display-1">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
