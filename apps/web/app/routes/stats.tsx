// The signed-in reader's reading stats (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. Real stat tiles, a books-per-month chart and a genre
// breakdown for the current year (Enarratio, in Capsomer's frame), plus year progress against
// any books-per-year goal as a meter. Read-only. Charts render only when their data exists in D1.
import { createDb, libraryRepo, views } from "@foxing/core";
import { ChartFrame } from "capsomer/react/chart-frame";
import { Meter } from "capsomer/react/meter";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { enhanceChart, genresChart, monthsChart } from "~/lib/reading-charts";
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
          <section className="mt-10 card card-5">
            <ChartFrame draw={monthsChart(monthly, year)} onDraw={enhanceChart} />
          </section>
        ) : null}

        {genres.length > 0 ? (
          <section className="mt-10 card card-5">
            <ChartFrame draw={genresChart(genres, year)} onDraw={enhanceChart} />
          </section>
        ) : null}

        <section className="mt-10">
          <Eyebrow className="mb-4">Goals</Eyebrow>
          {goals.length === 0 ? (
            <p className="meta">No goals set.</p>
          ) : (
            <ul className="stack-2">
              {goals.map((g) => {
                const label = `${numberFormat.format(g.target)} ${g.type} per ${g.periodType}`;
                return g.type === "books" && g.periodType === "year" && booksYearGoalTarget ? (
                  <Meter
                    key={g.id}
                    as="li"
                    className="py-3 fx-stats-card"
                    label={label}
                    value={finishedThisYear}
                    max={booksYearGoalTarget}
                    display={`${numberFormat.format(finishedThisYear)} / ${numberFormat.format(g.target)}`}
                    valueText={`${numberFormat.format(finishedThisYear)} of ${numberFormat.format(g.target)} books finished in ${year}`}
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

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
