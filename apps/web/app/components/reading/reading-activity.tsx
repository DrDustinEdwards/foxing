// The goals page's reading activity (app/routes/goals.tsx), drawn the same for a reader's own weeks
// and for the sample weeks of /demos/goals: books finished per week over the last year (Enarratio's
// heat strip, in Capsomer's frame) and the streak cards.
import type { Streak } from "@foxing/types";
import { ChartFrame } from "capsomer/react/chart-frame";
import { weeksChart } from "~/lib/reading-charts";

export function ReadingActivity({
  weeks,
  streak,
}: {
  weeks: Array<{ start: number; books: number }>;
  streak: Streak;
}) {
  return (
    <section className="stack">
      <h2 className="display-2">Reading activity</h2>
      <div className="card card-5">
        {weeks.some((w) => w.books > 0) ? (
          <ChartFrame draw={weeksChart(weeks)} />
        ) : (
          <ChartFrame
            noData={{
              title: "Books finished per week, the last year",
              reason: "No books finished in the last year.",
            }}
          />
        )}
      </div>
      <div className="fx-goals-grid">
        <StreakCard label="current streak" value={streak.currentStreak} hint="days in a row" />
        <StreakCard label="longest streak" value={streak.longestStreak} hint="all time" />
        <StreakCard label="books finished" value={streak.totalBooksFinished} hint="all time" />
        <StreakCard label="highlights" value={streak.totalHighlights} hint="all time" />
      </div>
    </section>
  );
}

function StreakCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card">
      <p className="display-2">{value.toLocaleString()}</p>
      <p className="mt-1 fx-goals-caps">{label}</p>
      <p className="fx-goals-text-4">{hint}</p>
    </div>
  );
}
