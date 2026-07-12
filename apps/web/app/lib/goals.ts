// Shared reading-goal client helpers, used by both the library sidebar card and the
// dedicated /goals page so the two never drift. The ISO-week math mirrors core
// periodRange (weeks start Monday; week 1 holds the year's first Thursday) so the client
// and the progress query agree on which finishes count.

export const MONTHS = [
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
