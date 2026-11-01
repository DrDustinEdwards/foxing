// The signed-in reader's OWN Year in Reading (auth-gated, noindex). Reuses the exact
// recap aggregation that powers the public /u/:username/recap/:year, targeted by user id
// so it is always the viewer's own. /year shows the current year; /year/:year picks one.
// A year picker links between years. The shareable public version lives on the profile.
import { createDb, views } from "@foxing/core";
import type { RecapBook } from "@foxing/types";
import { ChartFrame } from "capsomer/react/chart-frame";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { genresChart, monthsChart } from "~/lib/reading-charts";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/year";

export function meta() {
  return [{ title: "Your year in reading | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = params.year ? Number(params.year) : thisYear;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Response("Not found", { status: 404 });
  }
  const data = await views.recap(createDb(env.DB), { userId: user.id }, year, user.id);
  if (!data) throw new Response("Not found", { status: 404 });

  // Year picker spans this year back six, always including the selected one.
  const years = new Set<number>([year]);
  for (let y = thisYear; y >= thisYear - 6; y--) years.add(y);
  return {
    ...data,
    year,
    years: [...years].sort((a, b) => b - a),
  };
}

export default function Year({ loaderData }: Route.ComponentProps) {
  const { recap, year, years, username, monthly, genres } = loaderData;
  const firstBook = recap.finished[0];
  const lastBook = recap.finished[recap.finished.length - 1];
  const stats = [
    { label: "books finished", value: recap.booksFinished },
    { label: "words read", value: recap.totalWords ? recap.totalWords.toLocaleString() : "0" },
    { label: "distinct authors", value: recap.distinctAuthors },
    {
      label: "average rating",
      value: recap.averageRating != null ? recap.averageRating.toFixed(1) : "-",
    },
  ];

  return (
    <PageShell>
      <Container className="stack-8">
        <PageHeader
          eyebrow={`Year in Reading ${year}`}
          title="Your reading year"
          className="mb-0"
        />

        <nav aria-label="Choose a year" className="row-2 wrap">
          {years.map((y) => (
            <Link
              key={y}
              to={y === new Date().getUTCFullYear() ? "/year" : `/year/${y}`}
              aria-current={y === year ? "page" : undefined}
              className="cap-chip"
            >
              {y}
            </Link>
          ))}
        </nav>

        {recap.booksFinished === 0 ? (
          <EmptyState
            title={`No finishes logged in ${year}`}
            body="Books show up here as you mark them finished."
          />
        ) : (
          <>
            <section className="fx-year-grid">
              {stats.map((s) => (
                <div key={s.label} className="text-center fx-year-card">
                  <p className="display-3">{s.value}</p>
                  <p className="mt-1 fx-year-caps">{s.label}</p>
                </div>
              ))}
            </section>

            {monthly.some((n) => n > 0) ? (
              <section className="stack">
                <h2 className="display-2">Your reading months</h2>
                <div className="card card-5">
                  <ChartFrame draw={monthsChart(monthly, year)} />
                </div>
              </section>
            ) : null}

            {genres.length > 0 ? (
              <section className="stack">
                <h2 className="display-2">Genre spread</h2>
                <div className="card card-5">
                  <ChartFrame draw={genresChart(genres, year)} />
                </div>
              </section>
            ) : null}

            {firstBook && lastBook && recap.finished.length >= 2 ? (
              <section className="fx-year-grid-2">
                <Bookend label={`First finish of ${year}`} book={firstBook} />
                <Bookend label={`Latest finish of ${year}`} book={lastBook} />
              </section>
            ) : null}

            {recap.topBooks.length > 0 ? (
              <section className="stack">
                <h2 className="display-2">Top books</h2>
                <ol className="stack-2">
                  {recap.topBooks.map((b) => (
                    <li key={b.bookId} className="py-3 fx-year-card-2">
                      <Link to={`/books/${b.slug}`} className="fx-year-link">
                        {b.title}
                      </Link>
                      <span className="fx-year-label">
                        {b.ratingHalf != null ? `${(b.ratingHalf / 2).toFixed(1)}★` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        )}

        <p className="meta">
          Want to share this?{" "}
          <Link to={`/u/${username}/recap/${year}`} className="link">
            View the public version
          </Link>
          .
        </p>
      </Container>
    </PageShell>
  );
}

// The first and latest finish of the year, a small celebratory pair of bookends.
function Bookend({ label, book }: { label: string; book: RecapBook }) {
  return (
    <div className="card">
      <p className="fx-year-caps">{label}</p>
      <Link to={`/books/${book.slug}`} className="mt-1 block fx-year-link">
        {book.title}
      </Link>
      <p className="fx-year-text-2">{book.author}</p>
    </div>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
