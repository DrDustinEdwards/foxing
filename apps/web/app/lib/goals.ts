// Shared reading-goal client helpers, used by both the library sidebar card and the
// dedicated /goals page so the two never drift. The ISO-week math mirrors core
// periodRange (weeks start Monday; week 1 holds the year's first Thursday) so the client
// and the progress query agree on which finishes count.

const MONTHS = [
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

export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

export function goalPeriodLabel(goal: {
  periodType: string;
  year: number;
  month: number | null;
  week: number | null;
}): string {
  if (goal.periodType === "month" && goal.month) return `${MONTHS[goal.month - 1]} ${goal.year}`;
  if (goal.periodType === "week" && goal.week) return `week ${goal.week}, ${goal.year}`;
  return `${goal.year}`;
}

function clamp01(f: number): number {
  if (!Number.isFinite(f)) return 1;
  return Math.min(1, Math.max(0, f));
}

/** Fraction (0..1) of the goal's current period that has elapsed, for pacing feedback.
 *  Only meaningful for an active goal (its period contains `now`). Weeks start Monday to
 *  match isoWeek / core periodRange, all in UTC to agree with the progress query. */
export function periodElapsedFraction(periodType: string, now: Date): number {
  const ms = now.getTime();
  const y = now.getUTCFullYear();
  if (periodType === "month") {
    const m = now.getUTCMonth();
    return clamp01((ms - Date.UTC(y, m, 1)) / (Date.UTC(y, m + 1, 1) - Date.UTC(y, m, 1)));
  }
  if (periodType === "week") {
    const dow = (now.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
    const midnight = Date.UTC(y, now.getUTCMonth(), now.getUTCDate());
    return clamp01((dow * 86_400_000 + (ms - midnight)) / (7 * 86_400_000));
  }
  return clamp01((ms - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)));
}

/** Pacing verdict for an active, incomplete goal: on track if finished has kept pace with
 *  the share of the period elapsed, else how many behind to catch up. */
export function goalPacing(
  finished: number,
  target: number,
  fraction: number,
): { onTrack: true } | { onTrack: false; behind: number } {
  const expected = target * fraction;
  if (finished + 1e-9 >= expected) return { onTrack: true };
  return { onTrack: false, behind: Math.max(1, Math.ceil(expected - finished)) };
}
