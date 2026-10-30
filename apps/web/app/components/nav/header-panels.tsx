// The Books and Celebrity Picks panels of Capsomer's site header, and the same links as groups
// for the phone's sheet. Browse items are real routes; era chips map to /books?era= filters that
// ship today. By Mood is cut until mood_tags is populated (all catalog books are '[]' today). The
// era list mirrors core ERA_BUCKETS (facets.ts), kept local so the client bundle does not pull in
// the core query layer. Featured clubs come from the root loader (listExternalClubs), so the
// panel renders server-side; the Book of the Month card shows only when a published pick exists.
// Every item is a link, so the header's panel closes on its own when one is followed.
import type { HeaderGroup } from "capsomer/react/site-header";
import { Link } from "capsomer/react/link";
import type { NavBotm, NavFeaturedClub } from "~/lib/nav.server";

const BOOKS_BROWSE = [
  { href: "/books", label: "All books" },
  { href: "/awards", label: "Award winners" },
];
const BOOKS_ERAS = [
  { slug: "pre-1800", label: "Before 1800" },
  { slug: "1800-1849", label: "1800 to 1849" },
  { slug: "1850-1899", label: "1850 to 1899" },
  { slug: "1900-1949", label: "1900 to 1949" },
  { slug: "modern", label: "1950 and later" },
];

export const booksGroups: HeaderGroup[] = [
  { label: "Browse", links: BOOKS_BROWSE },
  {
    label: "By era",
    links: BOOKS_ERAS.map((era) => ({ href: `/books?era=${era.slug}`, label: era.label })),
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
          {BOOKS_ERAS.map((era) => (
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
      {botm ? (
        <Link to="/book-of-the-month" className="fx-panel-pick">
          <span className="group-label accent">Foxing pick</span>
          <span className="display-s">{botm.title}</span>
          <span className="fine">{botm.author}</span>
        </Link>
      ) : null}
      {featuredClubs.length > 0 ? (
        <>
          <div className="cap-site-header-panel-label">Featured clubs</div>
          <ul className="cap-site-header-panel-list fx-panel-two">
            {featuredClubs.map((club) => (
              <li key={club.slug}>
                <Link to={`/picks/${club.slug}`}>{club.name}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
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
