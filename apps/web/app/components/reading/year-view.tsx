import type { RecapBook, RecapPage } from "@foxing/types";
import { ChartFrame } from "capsomer/react/chart-frame";
import { Link } from "capsomer/react/link";
import type { ReactNode } from "react";
import { PageShell } from "~/components/page-shell";
import { TopBooks, YearNumbers } from "./recap-parts";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { genresChart, monthsChart } from "~/lib/reading-charts";

export type YearData = RecapPage & { year: number; years: number[] };

export function YearView({
  data,
  notice,
  yearHref,
  share = true,
}: {
  data: YearData;
  notice?: ReactNode;
  yearHref: (year: number) => string;
  share?: boolean;
}) {
  const { recap, year, years, username, monthly, genres } = data;
  const firstBook = recap.finished[0];
  const lastBook = recap.finished[recap.finished.length - 1];

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <PageHeader title="Your reading year" />
        {notice}

        <nav aria-label="Choose a year" className="cap-cluster" data-gap="3">
          {years.map((y) => (
            <Link
              key={y}
              to={yearHref(y)}
              aria-current={y === year ? "page" : undefined}
              className="cap-chip"
            >
              {y}
            </Link>
          ))}
        </nav>

        {recap.booksFinished === 0 ? (
          <EmptyState title={`No finishes logged in ${year}`} />
        ) : (
          <>
            <YearNumbers recap={recap} />

            {monthly.some((n) => n > 0) ? (
              <section className="cap-stack">
                <h2 className="cap-title" data-size="3">
                  Your reading months
                </h2>
                <div className="cap-card">
                  <ChartFrame draw={monthsChart(monthly, year)} />
                </div>
              </section>
            ) : null}

            {genres.length > 0 ? (
              <section className="cap-stack">
                <h2 className="cap-title" data-size="3">
                  Genre spread
                </h2>
                <div className="cap-card">
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

            <TopBooks books={recap.topBooks} />
          </>
        )}

        {share ? (
          <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
            <Link to={`/u/${username}/recap/${year}`} className="link">
              Public version
            </Link>
          </p>
        ) : null}
      </Container>
    </PageShell>
  );
}

function Bookend({ label, book }: { label: string; book: RecapBook }) {
  return (
    <div className="cap-card">
      <p className="fx-year-caps">{label}</p>
      <Link to={`/books/${book.slug}`} className="block fx-year-link">
        {book.title}
      </Link>
      <p className="fx-year-text-2">{book.author}</p>
    </div>
  );
}
