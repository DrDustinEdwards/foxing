import { catalogRepo } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Container, PageHeader } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/journal-series";

// A series' own page: every live part, in reading order. The series nav on each part links here.
export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const series = params.series;
  const parts = series ? await catalogRepo.listJournalSeriesParts(db, series) : [];
  // A series with no live part is not a page: its name is free text, so anything else is a guess.
  if (!series || parts.length === 0) throw new Response("Not found", { status: 404 });
  return { series, parts };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Series not found | Foxing" }];
  return buildMeta({
    title: data.series,
    description: `${data.series}: a series from the Foxing Journal, in ${data.parts.length} ${data.parts.length === 1 ? "part" : "parts"}, read in order.`,
    pathname: location.pathname,
    pageType: "CollectionPage",
    breadcrumbs: [
      { name: SITE_NAME, path: "/" },
      { name: "Journal", path: "/journal" },
      { name: "All articles", path: "/journal/archive" },
      { name: data.series, path: location.pathname.replace(/\/+$/, "") },
    ],
  });
}

export default function JournalSeries({ loaderData }: Route.ComponentProps) {
  const { series, parts } = loaderData;

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Journal", to: "/journal" },
            { label: "All articles", to: "/journal/archive" },
            { label: series },
          ]}
        />
        <PageHeader
          title={series}
          lede={`A series in ${parts.length} ${parts.length === 1 ? "part" : "parts"}`}
        />

        <ol className="fx-journal-tag-grid">
          {parts.map((post, i) => (
            <li key={post.slug}>
              <Link to={`/journal/${post.slug}`}>
                <div className="cap-card fx-journal-tag-card">
                  <span className="mb-2 fx-journal-tag-caps">Part {i + 1}</span>
                  <h2 className="fx-journal-tag-title">{post.title}</h2>
                  {post.excerpt ? <p className="mt-2 fx-journal-tag-text">{post.excerpt}</p> : null}
                  {post.readingTimeMinutes ? (
                    <p className="mt-3 fx-journal-tag-text-2">{post.readingTimeMinutes} min read</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </Container>
    </PageShell>
  );
}
