import { formatCount } from "@drdustinedwards/site-helpers/text";
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
    <section className="cap-stack">
      <h2 className="cap-title" data-size="3">
        Reading activity
      </h2>
      <div className="cap-card">
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
    <div className="cap-card">
      <p className="cap-title" data-size="3">
        {formatCount(value)}
      </p>
      <p className="fx-goals-caps">{label}</p>
      <p className="fx-goals-text-4">{hint}</p>
    </div>
  );
}
