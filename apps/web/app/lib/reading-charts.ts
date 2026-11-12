// The reader's charts, drawn by Enarratio into Capsomer's chart frame (ChartFrame redraws each one
// to its width and adds Enarratio's hover details, keyboard reading and sortable table). Each
// returns a draw for ChartFrame's `draw`, which takes `fit`: for a bar chart the height the server's
// drawing showed at the frame's width, so the redraw does not push the page down on a phone; for the
// weeks heat strip nothing, since a primitive keeps its own height. The figure carries the title, the
// finding, the drawing and, hidden, the numbers. The stats page and /year share the
// months and genres charts.
import { formatCount, plural } from "@drdustinedwards/site-helpers/text";
import { MONTH_ABBR, MONTH_NAMES } from "@foxing/client";
import { heatStrip } from "enarratio";
import { barChart } from "enarratio/lite/bar";
import type { ChartFit } from "capsomer/react/chart-frame";

const SOURCE = "Your Foxing library";

/** Books finished in each month of a year, as bars. */
export function monthsChart(monthly: number[], year: number) {
  const total = monthly.reduce((a, b) => a + b, 0);
  const top = monthly.indexOf(Math.max(...monthly));
  const alt = `${plural(total, "book", undefined, { grouped: true })} finished in ${year}, the most in ${MONTH_NAMES[top]} (${monthly[top]}).`;
  const data = monthly.map((books, i) => ({ month: MONTH_ABBR[i], books }));
  return (width: number, fit: ChartFit = {}) =>
    barChart({
      data,
      x: "month",
      y: "books",
      wholeNumbers: true,
      xDomain: MONTH_ABBR,
      width,
      height: 220,
      ...fit,
      id: `months-${year}`,
      title: `Books finished per month, ${year}`,
      alt,
      xLabel: "Month",
      yLabel: "Finished",
      yUnit: "books",
      formatValue: formatCount,
      source: SOURCE,
    });
}

/** The year's most-read subjects, as horizontal bars. */
export function genresChart(genres: Array<{ name: string; value: number }>, year: number) {
  const [top] = genres;
  const alt = `${top.name} led ${year} with ${plural(top.value, "book", undefined, { grouped: true })}, of the ${genres.length} most-read genres.`;
  const data = genres.map((g) => ({ genre: g.name, books: g.value }));
  return (width: number, fit: ChartFit = {}) =>
    barChart({
      data,
      x: "genre",
      y: "books",
      wholeNumbers: true,
      xDomain: genres.map((g) => g.name),
      orientation: "horizontal",
      width,
      height: 60 + genres.length * 36,
      ...fit,
      id: `genres-${year}`,
      title: `Top genres, ${year}`,
      alt,
      xLabel: "Genre",
      yLabel: "Finished",
      yUnit: "books",
      formatValue: formatCount,
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
  const alt = `${plural(total, "book", undefined, { grouped: true })} finished over the last ${weeks.length} weeks, in ${plural(active, "week", undefined, { grouped: true })}.`;
  return (width: number, fit: ChartFit = {}) =>
    heatStrip({
      values: weeks.map((w) => w.books),
      cellLabels: weeks.map((w) => label(w.start)),
      width,
      height: 32,
      ...fit,
      min: 0,
      id: "weeks",
      title: "Books finished per week, the last year",
      label: "Books finished per week",
      alt,
      formatValue: (n) => plural(n, "book", undefined, { grouped: true }),
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
    ? `${leaders.join(" and ")} ${verb} with ${plural(most, "vote", undefined, { grouped: true })} each, of ${plural(total, "vote", undefined, { grouped: true })}.`
    : `${leaders[0]} ${verb} with ${most} of ${plural(total, "vote", undefined, { grouped: true })}.`;
  const data = options.map((o) => ({ option: o.label, votes: o.votes }));
  return (width: number, fit: ChartFit = {}) =>
    barChart({
      data,
      x: "option",
      y: "votes",
      wholeNumbers: true,
      xDomain: options.map((o) => o.label),
      orientation: "horizontal",
      width,
      height: 60 + options.length * 36,
      ...fit,
      id: `poll-${id}`,
      title: closed ? "Final votes" : "Votes so far",
      alt,
      xLabel: "Option",
      yLabel: "Votes",
      yUnit: "votes",
      formatValue: formatCount,
      source: "Club members' votes",
    });
}
