// The reader's charts, drawn by Enarratio into Capsomer's chart frame (ChartFrame redraws each one
// to its width and adds Enarratio's hover details, keyboard reading and sortable table). Each
// returns a draw(width) for ChartFrame's `draw`; the figure carries the title, the finding, the
// drawing and the numbers behind "Show data". The stats page and /year share the months and
// genres charts.
import { MONTH_ABBR, MONTH_NAMES } from "@foxing/client";
import { heatStrip } from "enarratio";
import { barChart } from "enarratio/lite/bar";

const SOURCE = "Your Foxing library";
const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const whole = (n: number) => n.toLocaleString("en-US");

// One row per counted thing, so Enarratio counts the rows and keeps its value ticks whole.
const rows = <K extends string>(key: K, items: Array<[string, number]>) =>
  items.flatMap(([name, n]) =>
    Array.from({ length: n }, () => ({ [key]: name }) as Record<K, string>),
  );

/** Books finished in each month of a year, as bars. */
export function monthsChart(monthly: number[], year: number) {
  const total = monthly.reduce((a, b) => a + b, 0);
  const top = monthly.indexOf(Math.max(...monthly));
  const alt = `${count(total, "book")} finished in ${year}, the most in ${MONTH_NAMES[top]} (${monthly[top]}).`;
  const data = rows(
    "month",
    monthly.map((books, i) => [MONTH_ABBR[i], books]),
  );
  return (width: number) =>
    barChart({
      data,
      x: "month",
      xDomain: MONTH_ABBR,
      width,
      height: 220,
      id: `months-${year}`,
      title: `Books finished per month, ${year}`,
      alt,
      xLabel: "Month",
      yLabel: "Finished",
      yUnit: "books",
      formatValue: whole,
      source: SOURCE,
    });
}

/** The year's most-read subjects, as horizontal bars. */
export function genresChart(genres: Array<{ name: string; value: number }>, year: number) {
  const [top] = genres;
  const alt = `${top.name} led ${year} with ${count(top.value, "book")}, of the ${genres.length} most-read genres.`;
  const data = rows(
    "genre",
    genres.map((g) => [g.name, g.value]),
  );
  return (width: number) =>
    barChart({
      data,
      x: "genre",
      xDomain: genres.map((g) => g.name),
      orientation: "horizontal",
      width,
      height: 60 + genres.length * 36,
      id: `genres-${year}`,
      title: `Top genres, ${year}`,
      alt,
      xLabel: "Genre",
      yLabel: "Finished",
      yUnit: "books",
      formatValue: whole,
      notes: "A book counts once for each of its subjects.",
      source: SOURCE,
    });
}

/** Books finished in each week of the last year, oldest first, on the heat ramp. */
export function weeksChart(weeks: Array<{ start: number; books: number }>) {
  const label = (ms: number) => {
    const d = new Date(ms);
    return `Week of ${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const total = weeks.reduce((a, w) => a + w.books, 0);
  const active = weeks.filter((w) => w.books > 0).length;
  const alt = `${count(total, "book")} finished over the last ${weeks.length} weeks, in ${count(active, "week")}.`;
  return (width: number) =>
    heatStrip({
      values: weeks.map((w) => w.books),
      cellLabels: weeks.map((w) => label(w.start)),
      width,
      height: 32,
      min: 0,
      id: "weeks",
      title: "Books finished per week, the last year",
      label: "Books finished per week",
      alt,
      formatValue: (n) => count(n, "book"),
      source: SOURCE,
    });
}

/** Votes per option in a club poll, as horizontal bars. */
export function pollChart(
  id: string,
  options: Array<{ label: string; votes: number }>,
  closed: boolean,
) {
  const total = options.reduce((a, o) => a + o.votes, 0);
  const most = Math.max(...options.map((o) => o.votes));
  const leaders = options.filter((o) => o.votes === most).map((o) => o.label);
  const tied = leaders.length > 1;
  const verb = closed ? (tied ? "tied" : "won") : tied ? "tie" : "leads";
  const alt = tied
    ? `${leaders.join(" and ")} ${verb} with ${count(most, "vote")} each, of ${count(total, "vote")}.`
    : `${leaders[0]} ${verb} with ${most} of ${count(total, "vote")}.`;
  const data = rows(
    "option",
    options.map((o) => [o.label, o.votes]),
  );
  return (width: number) =>
    barChart({
      data,
      x: "option",
      xDomain: options.map((o) => o.label),
      orientation: "horizontal",
      width,
      height: 60 + options.length * 36,
      id: `poll-${id}`,
      title: closed ? "Final votes" : "Votes so far",
      alt,
      xLabel: "Option",
      yLabel: "Votes",
      yUnit: "votes",
      formatValue: whole,
      source: "Club members' votes",
    });
}
