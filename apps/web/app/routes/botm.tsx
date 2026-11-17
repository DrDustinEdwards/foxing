import { MONTH_NAMES } from "@foxing/client";
import { catalogRepo } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Button, Container, EmptyState, Eyebrow, PageHeader } from "~/components/ui";
import { catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/botm";

function monthLabel(year: number, month: number): string {
  return month >= 1 && month <= 12 ? `${MONTH_NAMES[month - 1]} ${year}` : String(year);
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const all = await catalogRepo.listBotm(db);
  return { current: all[0] ?? null, archive: all.slice(1) };
}

export const headers = catalogPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const title = "Book of the Month";
  const current = data?.current;
  return buildMeta({
    title,
    description: current?.book
      ? `This month on Foxing: ${current.book.title} by ${current.book.author}.`
      : "Foxing's monthly reading pick.",
    pathname: location.pathname,
  });
}

export default function Botm({ loaderData }: Route.ComponentProps) {
  const { current, archive } = loaderData;

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Foxing selects"
          title="Book of the Month"
          lede="One book, chosen each month, to read together."
        />

        <div className="cap-stack" data-gap="9">
          {!current?.book ? (
            <EmptyState title="No pick yet" body="The next Book of the Month lands soon." />
          ) : (
            <article className="cap-card fx-botm-card">
              <div className="fx-botm-box">
                <Link to={`/books/${current.book.slug}`}>
                  <CoverImage
                    src={current.book.coverUrl}
                    alt={`${current.book.title} by ${current.book.author}`}
                    fallbackLabel={current.book.title}
                    priority
                    sizes="(min-width: 64rem) 240px, 60vw"
                  />
                </Link>
              </div>
              <div className="cap-stack" data-gap="6">
                <div className="cap-stack" data-gap="3">
                  <Eyebrow>{monthLabel(current.year, current.month)}</Eyebrow>
                  <h2 className="fx-botm-title">
                    <Link to={`/books/${current.book.slug}`} className="hover-accent">
                      {current.book.title}
                    </Link>
                  </h2>
                  <p className="fx-botm-text">{current.book.author}</p>
                </div>
                {current.curatorNote ? (
                  <p className="fx-botm-text-2">{current.curatorNote}</p>
                ) : null}
                <div>
                  <Button to={`/books/${current.book.slug}`}>View the book</Button>
                </div>
              </div>
            </article>
          )}

          {archive.length > 0 ? (
            <section className="cap-stack" data-gap="6">
              <h2 className="fx-botm-title-2">Past picks</h2>
              <ul className="fx-botm-grid">
                {archive.map((e) =>
                  e.book ? (
                    <li key={e.id}>
                      <Link to={`/books/${e.book.slug}`} className="cap-stack" data-gap="3">
                        <CoverImage
                          src={e.book.coverUrl}
                          alt={`${e.book.title} by ${e.book.author}`}
                          fallbackLabel={e.book.title}
                          sizes="160px"
                        />
                        <p className="fx-botm-caps">{monthLabel(e.year, e.month)}</p>
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          ) : null}
        </div>
      </Container>
    </PageShell>
  );
}
