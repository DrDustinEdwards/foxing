// The signed-in reader's OWN Year in Reading (auth-gated, noindex). Reuses the exact
// recap aggregation that powers the public /u/:username/recap/:year, targeted by user id
// so it is always the viewer's own. /year shows the current year; /year/:year picks one.
// A year picker links between years. The shareable public version lives on the profile.
import { createDb, libraryRepo } from "@foxing/core";
import type { RecapBook } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { loadRecap } from "~/lib/social.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/year";
import { MONTH_INITIALS, MONTH_NAMES } from "~/lib/months";

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
  const data = await loadRecap(env, { userId: user.id }, year, user.id);
  if (!data) throw new Response("Not found", { status: 404 });

  // The finish dates + subjects for the selected year power the month strip and genre
  // spread (same query the stats page uses). Finished on the recap's finishedAt basis.
  const db = createDb(env.DB);
  const finishedBooks = await libraryRepo.listFinishedInRangeForStats(
    db,
    user.id,
    Date.UTC(year, 0, 1),
    Date.UTC(year + 1, 0, 1),
  );
  const monthly = Array<number>(12).fill(0);
  const genreCounts = new Map<string, number>();
  for (const b of finishedBooks) {
    if (b.finishedAt) monthly[b.finishedAt.getUTCMonth()] += 1;
    for (const s of b.subjects ?? []) {
      const name = s.trim();
      if (name) genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
    }
  }
  const genres = [...genreCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Year picker spans this year back six, always including the selected one.
  const years = new Set<number>([year]);
  for (let y = thisYear; y >= thisYear - 6; y--) years.add(y);
  return {
    recap: data.recap,
    displayName: data.displayName,
    username: data.username,
    year,
    monthly,
    genres,
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
      <Container className="max-w-3xl flex flex-col gap-8">
        <PageHeader
          eyebrow={`Year in Reading ${year}`}
          title="Your reading year"
          className="mb-0"
        />

        <nav aria-label="Choose a year" className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              to={y === new Date().getUTCFullYear() ? "/year" : `/year/${y}`}
              aria-current={y === year ? "page" : undefined}
              className="rounded-full border px-3 py-1 font-ui text-sm transition-colors aria-[current=page]:border-border-interactive aria-[current=page]:bg-selected aria-[current=page]:text-primary border-border-subtle text-secondary hover:border-border-interactive hover:text-primary"
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
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-card border border-border-subtle bg-surface p-5 text-center"
                >
                  <p className="font-display text-3xl text-primary">{s.value}</p>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-tertiary">
                    {s.label}
                  </p>
                </div>
              ))}
            </section>

            {monthly.some((n) => n > 0) ? (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-2xl">Your reading months</h2>
                <div className="rounded-card border border-border-subtle bg-surface p-5">
                  <MonthStrip monthly={monthly} year={year} />
                </div>
              </section>
            ) : null}

            {genres.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-2xl">Genre spread</h2>
                <div className="rounded-card border border-border-subtle bg-surface p-5">
                  <GenreSpread genres={genres} />
                </div>
              </section>
            ) : null}

            {firstBook && lastBook && recap.finished.length >= 2 ? (
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Bookend label={`First finish of ${year}`} book={firstBook} />
                <Bookend label={`Latest finish of ${year}`} book={lastBook} />
              </section>
            ) : null}

            {recap.topBooks.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-2xl">Top books</h2>
                <ol className="flex flex-col gap-2">
                  {recap.topBooks.map((b) => (
                    <li
                      key={b.bookId}
                      className="flex items-baseline justify-between gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3"
                    >
                      <Link
                        to={`/books/${b.slug}`}
                        className="font-display text-lg text-primary hover:text-brand-text"
                      >
                        {b.title}
                      </Link>
                      <span className="font-mono text-sm text-brand-text">
                        {b.ratingHalf != null ? `${(b.ratingHalf / 2).toFixed(1)}★` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        )}

        <p className="font-ui text-sm text-tertiary">
          Want to share this?{" "}
          <Link to={`/u/${username}/recap/${year}`} className="text-brand-text hover:underline">
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
      className="h-24 w-full"
      role="img"
      aria-label={`Books finished each month of ${year}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1="0"
        y1={baseY}
        x2={width}
        y2={baseY}
        className="stroke-border-subtle"
        strokeWidth="1"
      />
      {monthly.map((count, i) => {
        const h = count > 0 ? Math.max(3, (count / max) * plotH) : 0;
        const x = i * colW + (colW - barW) / 2;
        return (
          <g key={MONTH_NAMES[i]}>
            {h > 0 ? (
              <rect x={x} y={baseY - h} width={barW} height={h} rx="2" className="fill-brand">
                <title>{`${MONTH_NAMES[i]}: ${count} book${count === 1 ? "" : "s"}`}</title>
              </rect>
            ) : null}
            <text
              x={i * colW + colW / 2}
              y="78"
              textAnchor="middle"
              className="fill-tertiary font-mono"
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
    <ul className="flex flex-col gap-3">
      {genres.map((g) => {
        const pct = Math.max(4, (g.value / max) * 100);
        return (
          <li
            key={g.name}
            className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3"
            title={`${g.name}: ${g.value} book${g.value === 1 ? "" : "s"}`}
          >
            <span className="truncate font-ui text-sm capitalize text-secondary">{g.name}</span>
            <svg
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              className="h-1.5 w-full"
              aria-hidden="true"
            >
              <rect x="0" y="0" width="100" height="6" rx="3" className="fill-brand-subtle" />
              <rect x="0" y="0" width={pct} height="6" rx="3" className="fill-brand" />
            </svg>
            <span className="text-right font-mono text-xs text-tertiary">{g.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

// The first and latest finish of the year, a small celebratory pair of bookends.
function Bookend({ label, book }: { label: string; book: RecapBook }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-wide text-tertiary">{label}</p>
      <Link
        to={`/books/${book.slug}`}
        className="mt-1 block font-display text-lg text-primary hover:text-brand-text"
      >
        {book.title}
      </Link>
      <p className="mt-0.5 font-ui text-sm text-secondary">{book.author}</p>
    </div>
  );
}
