// The signed-in reader's OWN Year in Reading (auth-gated, noindex). Reuses the exact
// recap aggregation that powers the public /u/:username/recap/:year, targeted by user id
// so it is always the viewer's own. /year shows the current year; /year/:year picks one.
// A year picker links between years. The shareable public version lives on the profile.
import { MONTH_INITIALS, MONTH_NAMES } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import type { RecapBook } from "@foxing/types";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/year";

export function meta() {
  return [{ title: "Your year in reading | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = params.year ? Number(params.year) : thisYear;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Response("Not found", { status: 404 });
  }
  const data = await views.recap(createDb(env.DB), { userId: user.id }, year, user.id);
  if (!data) throw new Response("Not found", { status: 404 });

  // Year picker spans this year back six, always including the selected one.
  const years = new Set<number>([year]);
  for (let y = thisYear; y >= thisYear - 6; y--) years.add(y);
  return {
    ...data,
    year,
    years: [...years].sort((a, b) => b - a),
  };
}

export default function Year({ loaderData }: Route.ComponentProps) {
  const { recap, year, years, username, monthly, genres } = loaderData;
  const firstBook = recap.finished[0];
  const lastBook = recap.finished[recap.finished.length - 1];
  const stats = [
    { label: "books finished", value: recap.booksFinished },
    { label: "words read", value: recap.totalWords ? recap.totalWords.toLocaleString() : "0" },
    { label: "distinct authors", value: recap.distinctAuthors },
    {
      label: "average rating",
      value: recap.averageRating != null ? recap.averageRating.toFixed(1) : "-",
    },
  ];

  return (
    <PageShell>
      <Container className="stack-8">
        <PageHeader
          eyebrow={`Year in Reading ${year}`}
          title="Your reading year"
          className="mb-0"
        />

        <nav aria-label="Choose a year" className="row-2 wrap">
          {years.map((y) => (
            <Link
              key={y}
              to={y === new Date().getUTCFullYear() ? "/year" : `/year/${y}`}
              aria-current={y === year ? "page" : undefined}
              className="cap-chip"
            >
              {y}
            </Link>
          ))}
        </nav>

        {recap.booksFinished === 0 ? (
          <EmptyState
            title={`No finishes logged in ${year}`}
            body="Books show up here as you mark them finished."
          />
        ) : (
          <>
            <section className="fx-year-grid">
              {stats.map((s) => (
                <div key={s.label} className="text-center fx-year-card">
                  <p className="display-3">{s.value}</p>
                  <p className="mt-1 fx-year-caps">{s.label}</p>
                </div>
              ))}
            </section>

            {monthly.some((n) => n > 0) ? (
              <section className="stack">
                <h2 className="display-2">Your reading months</h2>
                <div className="card card-5">
                  <MonthStrip monthly={monthly} year={year} />
                </div>
              </section>
            ) : null}

            {genres.length > 0 ? (
              <section className="stack">
                <h2 className="display-2">Genre spread</h2>
                <div className="card card-5">
                  <GenreSpread genres={genres} />
                </div>
              </section>
            ) : null}

            {firstBook && lastBook && recap.finished.length >= 2 ? (
              <section className="fx-year-grid-2">
                <Bookend label={`First finish of ${year}`} book={firstBook} />
                <Bookend label={`Latest finish of ${year}`} book={lastBook} />
              </section>
            ) : null}

            {recap.topBooks.length > 0 ? (
              <section className="stack">
                <h2 className="display-2">Top books</h2>
                <ol className="stack-2">
                  {recap.topBooks.map((b) => (
                    <li key={b.bookId} className="py-3 fx-year-card-2">
                      <Link to={`/books/${b.slug}`} className="fx-year-link">
                        {b.title}
                      </Link>
                      <span className="fx-year-label">
                        {b.ratingHalf != null ? `${(b.ratingHalf / 2).toFixed(1)}★` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        )}

        <p className="meta">
          Want to share this?{" "}
          <Link to={`/u/${username}/recap/${year}`} className="link">
            View the public version
          </Link>
          .
        </p>
      </Container>
    </PageShell>
  );
}

// Books finished per month of the year: inline SVG bars over a subtle baseline. Same shape
// as the stats page's monthly view, kept local so /year stays self-contained.
function MonthStrip({ monthly, year }: { monthly: number[]; year: number }) {
  const max = Math.max(1, ...monthly);
  const colW = 24;
  const barW = 12;
  const plotH = 56;
  const baseY = 64;
  const width = colW * 12;
  return (
    <svg
      viewBox={`0 0 ${width} 84`}
      className="fx-year-icon"
      role="img"
      aria-label={`Books finished each month of ${year}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1="0" y1={baseY} x2={width} y2={baseY} className="fx-year-line" strokeWidth="1" />
      {monthly.map((count, i) => {
        const h = count > 0 ? Math.max(3, (count / max) * plotH) : 0;
        const x = i * colW + (colW - barW) / 2;
        return (
          <g key={MONTH_NAMES[i]}>
            {h > 0 ? (
              <rect x={x} y={baseY - h} width={barW} height={h} rx="2" className="fx-year-bar">
                <title>{`${MONTH_NAMES[i]}: ${count} book${count === 1 ? "" : "s"}`}</title>
              </rect>
            ) : null}
            <text
              x={i * colW + colW / 2}
              y="78"
              textAnchor="middle"
              className="fx-year-text"
              fontSize="9"
            >
              {MONTH_INITIALS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Top genres of the year as labelled horizontal bars, widths relative to the most-read.
function GenreSpread({ genres }: { genres: Array<{ name: string; value: number }> }) {
  const max = Math.max(1, ...genres.map((g) => g.value));
  return (
    <ul className="stack-3">
      {genres.map((g) => {
        const pct = Math.max(4, (g.value / max) * 100);
        return (
          <li
            key={g.name}
            className="fx-year-grid-3"
            title={`${g.name}: ${g.value} book${g.value === 1 ? "" : "s"}`}
          >
            <span className="truncate fx-year-label-2">{g.name}</span>
            <svg
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              className="fx-year-icon-2"
              aria-hidden="true"
            >
              <rect x="0" y="0" width="100" height="6" rx="3" className="fx-year-bar-2" />
              <rect x="0" y="0" width={pct} height="6" rx="3" className="fx-year-bar" />
            </svg>
            <span className="fx-year-label-3">{g.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

// The first and latest finish of the year, a small celebratory pair of bookends.
function Bookend({ label, book }: { label: string; book: RecapBook }) {
  return (
    <div className="card">
      <p className="fx-year-caps">{label}</p>
      <Link to={`/books/${book.slug}`} className="mt-1 block fx-year-link">
        {book.title}
      </Link>
      <p className="fx-year-text-2">{book.author}</p>
    </div>
  );
}
