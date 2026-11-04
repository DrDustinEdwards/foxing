// The reading stats page's body (app/routes/stats.tsx), drawn the same for a reader's own numbers and
// for the sample numbers of /demos/stats: stat tiles, a books-per-month chart and a genre breakdown
// for the current year (Enarratio, in Capsomer's frame), and year progress against any books-per-year
// goal as a meter. Charts render only when their data exists.
import type { ReadingStats } from "@foxing/types";
import { ChartFrame } from "capsomer/react/chart-frame";
import { Meter } from "capsomer/react/meter";
import { numberFormat } from "enarratio";
import type { ReactNode } from "react";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow, PageHeader } from "~/components/ui";
import { genresChart, monthsChart } from "~/lib/reading-charts";

export type StatsData = ReadingStats & {
  goals: Array<{ id: string; type: string; target: number; periodType: string }>;
};

const formatNumber = numberFormat();
export function StatsView({ data, notice }: { data: StatsData; notice?: ReactNode }) {
  const {
    year,
    finishedThisYear,
    monthly,
    genres,
    booksYearGoalTarget,
    streak: stats,
    goals,
  } = data;
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
        {notice ? <div className="mb-6">{notice}</div> : null}

        <dl className="fx-stats-grid">
          {tiles.map((tile) => (
            <div key={tile.label} className="card card-5">
              <dd className="display-3">{formatNumber(tile.value)}</dd>
              <dt className="mt-1 fx-stats-caps">{tile.label}</dt>
            </div>
          ))}
        </dl>

        {finishedThisYear > 0 ? (
          <section className="mt-10 card card-5">
            <ChartFrame draw={monthsChart(monthly, year)} />
          </section>
        ) : null}

        {genres.length > 0 ? (
          <section className="mt-10 card card-5">
            <ChartFrame draw={genresChart(genres, year)} />
          </section>
        ) : null}

        <section className="mt-10">
          <Eyebrow className="mb-4">Goals</Eyebrow>
          {goals.length === 0 ? (
            <p className="meta">No goals set.</p>
          ) : (
            <ul className="stack-2">
              {goals.map((g) => {
                const label = `${formatNumber(g.target)} ${g.type} per ${g.periodType}`;
                return g.type === "books" && g.periodType === "year" && booksYearGoalTarget ? (
                  <Meter
                    key={g.id}
                    as="li"
                    className="py-3 fx-stats-card"
                    label={label}
                    value={finishedThisYear}
                    max={booksYearGoalTarget}
                    display={`${formatNumber(finishedThisYear)} / ${formatNumber(g.target)}`}
                    valueText={`${formatNumber(finishedThisYear)} of ${formatNumber(g.target)} books finished in ${year}`}
                  />
                ) : (
                  <li key={g.id} className="py-3 fx-stats-card">
                    <span className="fx-stats-label">{label}</span>
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
