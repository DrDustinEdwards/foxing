// The Books and Celebrity Picks panels of Capsomer's site header, and the same links as groups for the phone's sheet.
import { ERA_BUCKETS } from "@foxing/core/catalog-buckets";
import type { HeaderGroup } from "capsomer/react/site-header";
import { Link } from "capsomer/react/link";
import type { NavBotm, NavFeaturedClub } from "~/lib/nav.server";

const BOOKS_BROWSE = [
  { href: "/books", label: "All books" },
  { href: "/awards", label: "Award winners" },
];

export const booksGroups: HeaderGroup[] = [
  { label: "Browse", links: BOOKS_BROWSE },
  {
    label: "By era",
    links: ERA_BUCKETS.map((era) => ({ href: `/books?era=${era.slug}`, label: era.label })),
  },
];

export function BooksPanel() {
  return (
    <div className="fx-panel fx-panel-books">
      <div>
        <div className="cap-site-header-panel-label">Browse</div>
        <ul className="cap-site-header-panel-list">
          {BOOKS_BROWSE.map((item) => (
            <li key={item.href}>
              <Link to={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="cap-site-header-panel-label">By era</div>
        <ul className="fx-panel-chips">
          {ERA_BUCKETS.map((era) => (
            <li key={era.slug}>
              <Link to={`/books?era=${era.slug}`} className="fx-tag">
                {era.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function picksGroups(featuredClubs: NavFeaturedClub[], botm: NavBotm | null): HeaderGroup[] {
  return [
    ...(botm
      ? [{ label: "Foxing pick", links: [{ href: "/book-of-the-month", label: botm.title }] }]
      : []),
    ...(featuredClubs.length > 0
      ? [
          {
            label: "Featured clubs",
            links: featuredClubs.map((club) => ({ href: `/picks/${club.slug}`, label: club.name })),
          },
        ]
      : []),
    {
      links: [
        { href: "/picks", label: "View all picks" },
        { href: "/book-of-the-month", label: "This month's pick" },
      ],
    },
  ];
}

export function PicksPanel({
  featuredClubs,
  botm,
}: {
  featuredClubs: NavFeaturedClub[];
  botm: NavBotm | null;
}) {
  return (
    <div className="fx-panel fx-panel-picks">
      <div className="cap-stack" data-gap="4">
        {botm ? (
          <Link to="/book-of-the-month" className="fx-panel-pick">
            <span className="cap-text group-label" data-tone="accent">
              Foxing pick
            </span>
            <span className="cap-title" data-size="6">
              {botm.title}
            </span>
            <span className="cap-text" data-size="tiny" data-tone="dim" data-face="ui">
              {botm.author}
            </span>
          </Link>
        ) : null}
        {featuredClubs.length > 0 ? (
          <div>
            <div className="cap-site-header-panel-label">Featured clubs</div>
            <ul className="cap-site-header-panel-list fx-panel-two">
              {featuredClubs.map((club) => (
                <li key={club.slug}>
                  <Link to={`/picks/${club.slug}`}>{club.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <hr />
      <ul className="cap-site-header-panel-list fx-panel-foot">
        <li>
          <Link to="/picks">View all picks</Link>
        </li>
        <li>
          <Link to="/book-of-the-month">This month's pick</Link>
        </li>
      </ul>
    </div>
  );
}
