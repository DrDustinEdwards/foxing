// The signed-in reader's reading stats (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. Real stat tiles, a books-per-month chart and a genre
// breakdown for the current year (inline SVG, no chart library), plus year progress against
// any books-per-year goal. Read-only. Charts render only when their data exists in D1.
import { MONTH_INITIALS, MONTH_NAMES } from "@foxing/client";
import { createDb, libraryRepo, views } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/stats";

export function meta() {
  return [{ title: "Reading stats | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const [stats, goals] = await Promise.all([
    views.stats(db, user.id),
    libraryRepo.listGoals(db, user.id),
  ]);
  return {
    ...stats,
    goals: goals.map((g) => ({
      id: g.id,
      type: g.type,
      target: g.target,
      periodType: g.periodType,
    })),
  };
}

const numberFormat = new Intl.NumberFormat("en-US");
export default function Stats({ loaderData }: Route.ComponentProps) {
  const {
    year,
    finishedThisYear,
    monthly,
    genres,
    booksYearGoalTarget,
    streak: stats,
    goals,
  } = loaderData;
  const tiles = [
    { label: "current streak", value: stats.currentStreak },
    { label: "longest streak", value: stats.longestStreak },
    { label: "books finished", value: stats.totalBooksFinished },
    { label: `finished in ${year}`, value: finishedThisYear },
    { label: "pages read", value: stats.totalPagesRead },
    { label: "highlights", value: stats.totalHighlights },
    { label: "words looked up", value: stats.totalWordsLookedUp },
  ];

  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Reading" title="Your stats" />

        <dl className="fx-stats-grid">
          {tiles.map((tile) => (
            <div key={tile.label} className="card card-5">
              <dd className="display-3">{numberFormat.format(tile.value)}</dd>
              <dt className="mt-1 fx-stats-caps">{tile.label}</dt>
            </div>
          ))}
        </dl>

        {finishedThisYear > 0 ? (
          <section className="mt-10">
            <Eyebrow className="mb-4">Books finished in {year}</Eyebrow>
            <div className="card card-5">
              <MonthlyBooksChart monthly={monthly} />
            </div>
          </section>
        ) : null}

        {genres.length > 0 ? (
          <section className="mt-10">
            <Eyebrow className="mb-4">Genres this year</Eyebrow>
            <div className="card card-5">
              <GenreBars genres={genres} />
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <Eyebrow className="mb-4">Goals</Eyebrow>
          {goals.length === 0 ? (
            <p className="meta">No goals set.</p>
          ) : (
            <ul className="stack-2">
              {goals.map((g) => {
                const isYearBooks = g.type === "books" && g.periodType === "year";
                return (
                  <li key={g.id} className="py-3 fx-stats-card">
                    <div className="row spread">
                      <span className="fx-stats-label">
                        {numberFormat.format(g.target)} {g.type} per {g.periodType}
                      </span>
                      {isYearBooks ? (
                        <span className="mono fine">
                          {numberFormat.format(finishedThisYear)} / {numberFormat.format(g.target)}
                        </span>
                      ) : null}
                    </div>
                    {isYearBooks && booksYearGoalTarget ? (
                      <ProgressBar value={finishedThisYear} max={booksYearGoalTarget} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Container>
    </PageShell>
  );
}

// Vertical bar chart of books finished per month. Inline SVG, brand-filled bars over a
// subtle baseline; a book count sits in each bar's title for hover/AT.
function MonthlyBooksChart({ monthly }: { monthly: number[] }) {
  const max = Math.max(1, ...monthly);
  const colW = 24;
  const barW = 12;
  const plotH = 56;
  const baseY = 64;
  const width = colW * 12;
  return (
    <svg
      viewBox={`0 0 ${width} 84`}
      className="fx-stats-icon"
      role="img"
      aria-label="Books finished each month this year"
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1="0" y1={baseY} x2={width} y2={baseY} className="fx-stats-line" strokeWidth="1" />
      {monthly.map((count, i) => {
        const h = count > 0 ? Math.max(3, (count / max) * plotH) : 0;
        const x = i * colW + (colW - barW) / 2;
        return (
          <g key={MONTH_NAMES[i]}>
            {h > 0 ? (
              <rect x={x} y={baseY - h} width={barW} height={h} rx="2" className="fx-stats-bar">
                <title>{`${MONTH_NAMES[i]}: ${count} book${count === 1 ? "" : "s"}`}</title>
              </rect>
            ) : null}
            <text
              x={i * colW + colW / 2}
              y="78"
              textAnchor="middle"
              className="fx-stats-text"
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

// Horizontal bars for the top genres. Label, an inline SVG bar (brand fill over a subtle
// track), and the count. Widths are relative to the most-read genre.
function GenreBars({ genres }: { genres: Array<{ name: string; value: number }> }) {
  const max = Math.max(1, ...genres.map((g) => g.value));
  return (
    <ul className="stack-3">
      {genres.map((g) => {
        const pct = Math.max(4, (g.value / max) * 100);
        return (
          <li
            key={g.name}
            className="fx-stats-grid-2"
            title={`${g.name}: ${g.value} book${g.value === 1 ? "" : "s"}`}
          >
            <span className="truncate fx-stats-label-2">{g.name}</span>
            <svg
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              className="fx-stats-icon-2"
              aria-hidden="true"
            >
              <rect x="0" y="0" width="100" height="6" rx="3" className="fx-stats-bar-2" />
              <rect x="0" y="0" width={pct} height="6" rx="3" className="fx-stats-bar" />
            </svg>
            <span className="fx-stats-label-3">{g.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

// A single progress bar for a goal (finished vs target), clamped to 100%.
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <svg
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      className="mt-2 fx-stats-icon-2"
      role="img"
      aria-label={`${value} of ${max} finished, ${pct} percent`}
    >
      <rect x="0" y="0" width="100" height="6" rx="3" className="fx-stats-bar-2" />
      <rect x="0" y="0" width={pct} height="6" rx="3" className="fx-stats-bar" />
    </svg>
  );
}
