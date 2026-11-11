// The account panel of Capsomer's site header for a signed-in reader: identity and tier badge,
// real stats (from the root loader's navUser), grouped links and a compact icon footer bar,
// matching the legacy dropdown (no scroll). Capsomer draws the button and the panel around it,
// and closes the panel when a link in it is followed. Icons are Capsomer's (capsomer/react/icons);
// the four the shared set lacks pass their own path on its grid.
import type { HeaderAccount } from "capsomer/react/site-header";
import { Icon, type IconName } from "capsomer/react/icons";
import { Link } from "capsomer/react/link";
import type { NavUser } from "~/lib/nav.server";
import { Avatar } from "../ui";

// Each menu icon: a name in Capsomer's set, or Foxing's own drawing on the same 24-unit grid.
const OWN = {
  findnext:
    "M11 4l1.5 4L16.5 9.5 12.5 11 11 15l-1.5-4L5.5 9.5 9.5 8zM17.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
  profile: "M12 5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM5.5 19.5a6.5 6.5 0 0 1 13 0",
  admin: "M12 3.5l7 2.8v4.7c0 4.3-2.9 7.2-7 8.5-4.1-1.3-7-4.2-7-8.5V6.3z",
  signout:
    "M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M10 12h10M17 9l3 3-3 3",
};
type MenuIcon = IconName | keyof typeof OWN;

function MenuIconSvg({ name }: { name: MenuIcon }) {
  return name in OWN ? (
    <Icon d={OWN[name as keyof typeof OWN]} />
  ) : (
    <Icon name={name as IconName} />
  );
}

// Reading surfaces. The secondary bar holds the primary four (Home, Library, Feed,
// People); notifications have the header bell. Collections is one compact row whose
// sublinks reach the real routes (buddy reads + saved are cut).
const READING_LINKS = [
  { to: "/stats", label: "Stats", icon: "stats" as const },
  { to: "/goals", label: "Goals", icon: "goals" as const },
  { to: "/year", label: "Year in reading", icon: "award" as const },
];
const COLLECTION_LINKS = [
  { to: "/lists", label: "Lists" },
  { to: "/diary", label: "Diary" },
  { to: "/highlights", label: "Highlights" },
  { to: "/commonplace", label: "Commonplace" },
];

function MenuLink({
  to,
  label,
  sublabel,
  icon,
}: {
  to: string;
  label: string;
  sublabel?: string;
  icon: MenuIcon;
}) {
  return (
    <Link to={to} className="fx-acct-link">
      <span className="fx-acct-icon">
        <MenuIconSvg name={icon} />
      </span>
      <span className="min-0 fx-account-panel-label">
        <span className="fx-acct-label">{label}</span>
        {sublabel ? <span className="fx-acct-sub">{sublabel}</span> : null}
      </span>
    </Link>
  );
}

// One dense Collections row: label plus an inline list of the real collection routes.
function CollectionsRow() {
  return (
    <div className="fx-acct-row">
      <span className="fx-acct-icon">
        <Icon name="folder" />
      </span>
      <div className="min-0">
        <span className="fx-acct-label">Collections</span>
        <span className="fx-acct-sub fx-acct-inline">
          {COLLECTION_LINKS.map((l, i) => (
            <span key={l.to}>
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              <Link to={l.to}>{l.label}</Link>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

// Compact footer action: icon above a small label, in a divided 3-up bar.
function FooterAction({
  icon,
  label,
  to,
  onClick,
  danger,
  disabled,
}: {
  icon: MenuIcon;
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <MenuIconSvg name={icon} />
      <span>{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="fx-acct-foot">
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="fx-acct-foot"
      data-tone={danger ? "crit" : undefined}
      data-panel-close=""
    >
      {inner}
    </button>
  );
}

function TierBadge({ tier }: { tier: "free" | "plus" }) {
  const isPlus = tier === "plus";
  return <span className={isPlus ? "badge" : "badge badge-quiet"}>{isPlus ? "Plus" : "Free"}</span>;
}

/** Two-letter initials for the header's account button. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The header's account slot: the rich panel on a desktop, the same links in the phone's sheet. */
export function headerAccount(
  user: NavUser,
  signingOut: boolean,
  onSignOut: () => void,
): HeaderAccount {
  return {
    name: user.displayName,
    initials: initials(user.displayName),
    avatar: user.avatarUrl ?? undefined,
    detail: `@${user.username}`,
    onSignOut,
    signOutDisabled: signingOut,
    groups: [
      {
        links: [
          ...READING_LINKS.map((l) => ({ label: l.label, href: l.to })),
          { label: "Vocabulary", href: "/vocabulary" },
          ...COLLECTION_LINKS.map((l) => ({ label: l.label, href: l.to })),
          { label: "Find next book", href: "/find-next-book" },
          ...(user.isAdmin ? [{ label: "Admin dashboard", href: "/admin" }] : []),
          { label: "Profile", href: `/u/${user.username}` },
          { label: "Settings", href: "/settings" },
        ],
      },
    ],
    panel: <AccountPanel user={user} signingOut={signingOut} onSignOut={onSignOut} />,
  };
}

function AccountPanel({
  user,
  signingOut,
  onSignOut,
}: {
  user: NavUser;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const stats = [
    { label: "books this year", value: user.stats.booksThisYear },
    { label: "day streak", value: user.stats.dayStreak },
    { label: "highlights", value: user.stats.highlights },
  ];
  const vocab =
    user.vocabularyToMaster > 0
      ? `${user.vocabularyToMaster} ${user.vocabularyToMaster === 1 ? "word" : "words"} to master`
      : undefined;

  return (
    <div className="fx-acct">
      <div className="fx-acct-who">
        <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
        <div className="min-0">
          <p className="cap-cluster strong sans small" data-gap="2">
            <span className="truncate">{user.displayName}</span>
            <TierBadge tier={user.subscriptionTier} />
          </p>
          <p className="truncate mono fine">@{user.username}</p>
        </div>
      </div>

      <dl className="fx-acct-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dd className="display-1">{stat.value}</dd>
            <dt>{stat.label}</dt>
          </div>
        ))}
      </dl>

      <div className="fx-acct-group">
        {READING_LINKS.map((l) => (
          <MenuLink key={l.to} to={l.to} label={l.label} icon={l.icon} />
        ))}
        <MenuLink to="/vocabulary" label="Vocabulary" sublabel={vocab} icon="book" />
      </div>

      <div className="fx-acct-group">
        <CollectionsRow />
      </div>

      <div className="fx-acct-group">
        <MenuLink
          to="/find-next-book"
          label="Find next book"
          sublabel="AI recommendations for you"
          icon="findnext"
        />
        {user.isAdmin ? <MenuLink to="/admin" label="Admin dashboard" icon="admin" /> : null}
      </div>

      <div className="fx-acct-foots">
        <FooterAction icon="profile" label="Profile" to={`/u/${user.username}`} />
        <FooterAction icon="settings" label="Settings" to="/settings" />
        <FooterAction
          icon="signout"
          label={signingOut ? "..." : "Sign out"}
          onClick={onSignOut}
          danger
          disabled={signingOut}
        />
      </div>
    </div>
  );
}
