// The signed-in reader's reading stats (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. A grid of streak tiles plus active goals. Read-only.
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
  const [streak, finishedThisYear, goals] = await Promise.all([
    libraryRepo.getStreak(db, user.id),
    libraryRepo.countFinishedInPeriod(db, user.id, { periodType: "year", year }),
    libraryRepo.listGoals(db, user.id),
  ]);
  return {
    year,
    finishedThisYear,
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

export default function Stats({ loaderData }: Route.ComponentProps) {
  const { year, finishedThisYear, stats, goals } = loaderData;
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

        <section className="mt-10">
          <Eyebrow className="mb-4">Goals</Eyebrow>
          {goals.length === 0 ? (
            <p className="font-ui text-sm text-tertiary">No goals set.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {goals.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface px-4 py-3"
                >
                  <span className="font-ui text-sm text-primary">
                    {numberFormat.format(g.target)} {g.type} per {g.periodType}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </PageShell>
  );
}
