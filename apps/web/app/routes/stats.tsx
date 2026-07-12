// The signed-in reader's reading stats (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. Real stat tiles, a books-per-month chart and a genre
// breakdown for the current year (inline SVG, no chart library), plus year progress against
// any books-per-year goal. Read-only. Charts render only when their data exists in D1.
import { createDb, libraryRepo } from "@foxing/core";
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
  const year = new Date().getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);

  const [streak, finishedThisYear, goals, finishedBooks] = await Promise.all([
    libraryRepo.getStreak(db, user.id),
    libraryRepo.countFinishedInPeriod(db, user.id, { periodType: "year", year }),
    libraryRepo.listGoals(db, user.id),
    libraryRepo.listFinishedInRangeForStats(db, user.id, yearStart, yearEnd),
  ]);

  // Books finished per month of the current year (12 buckets).
  const monthly = Array<number>(12).fill(0);
  for (const b of finishedBooks) {
    if (b.finishedAt) monthly[b.finishedAt.getUTCMonth()] += 1;
  }

  // Genre breakdown from the subjects of this year's finished books (top 6).
  const genreCounts = new Map<string, number>();
  for (const b of finishedBooks) {
    for (const s of b.subjects ?? []) {
      const name = s.trim();
      if (name) genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
    }
  }
  const genres = [...genreCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const booksYearGoal = goals.find((g) => g.type === "books" && g.periodType === "year");

  return {
    year,
    finishedThisYear,
    monthly,
    genres,
    booksYearGoalTarget: booksYearGoal?.target ?? null,
    stats: {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      totalBooksFinished: streak?.totalBooksFinished ?? 0,
      totalPagesRead: streak?.totalPagesRead ?? 0,
      totalHighlights: streak?.totalHighlights ?? 0,
      totalWordsLookedUp: streak?.totalWordsLookedUp ?? 0,
    },
    goals: goals.map((g) => ({
      id: g.id,
      type: g.type,
      target: g.target,
      periodType: g.periodType,
    })),
  };
}

const numberFormat = new Intl.NumberFormat("en-US");
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function Stats({ loaderData }: Route.ComponentProps) {
  const { year, finishedThisYear, monthly, genres, booksYearGoalTarget, stats, goals } = loaderData;
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
      <Container className="max-w-3xl">
        <PageHeader eyebrow="Reading" title="Your stats" />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-card border border-border-subtle bg-surface p-5"
            >
              <dd className="font-display text-3xl text-primary">
                {numberFormat.format(tile.value)}
              </dd>
              <dt className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-tertiary">
                {tile.label}
              </dt>
            </div>
          ))}
        </dl>

        {finishedThisYear > 0 ? (
          <section className="mt-10">
            <Eyebrow className="mb-4">Books finished in {year}</Eyebrow>
            <div className="rounded-card border border-border-subtle bg-surface p-5">
              <MonthlyBooksChart monthly={monthly} />
            </div>
          </section>
        ) : null}

        {genres.length > 0 ? (
          <section className="mt-10">
            <Eyebrow className="mb-4">Genres this year</Eyebrow>
            <div className="rounded-card border border-border-subtle bg-surface p-5">
              <GenreBars genres={genres} />
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <Eyebrow className="mb-4">Goals</Eyebrow>
          {goals.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No goals set.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {goals.map((g) => {
                const isYearBooks = g.type === "books" && g.periodType === "year";
                return (
                  <li
                    key={g.id}
                    className="rounded-md border border-border-subtle bg-surface px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-ui text-sm text-primary">
                        {numberFormat.format(g.target)} {g.type} per {g.periodType}
                      </span>
                      {isYearBooks ? (
                        <span className="font-mono text-xs text-tertiary">
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
      className="h-24 w-full"
      role="img"
      aria-label="Books finished each month this year"
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1="0" y1={baseY} x2={width} y2={baseY} className="stroke-border-subtle" strokeWidth="1" />
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
              {MONTHS[i]}
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
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-1.5 w-full" aria-hidden="true">
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

// A single progress bar for a goal (finished vs target), clamped to 100%.
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <svg
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      className="mt-2 h-1.5 w-full"
      role="img"
      aria-label={`${value} of ${max} finished, ${pct} percent`}
    >
      <rect x="0" y="0" width="100" height="6" rx="3" className="fill-brand-subtle" />
      <rect x="0" y="0" width={pct} height="6" rx="3" className="fill-brand" />
    </svg>
  );
}
