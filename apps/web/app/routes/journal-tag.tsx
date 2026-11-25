import { titleCase } from "@drdustinedwards/site-helpers/text";
import { catalogRepo } from "@foxing/core";
import { redirect } from "react-router";
import { pageHref, parsePage } from "capsomer/behavior/pagination";
import { JournalCard } from "~/components/journal-card";
import { PageShell } from "~/components/page-shell";
import { Pager } from "~/components/pager";
import { Breadcrumbs, Container, EmptyState, PageHeader } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, journalTagPath, SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/journal-tag";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const tag = params.tag;
  if (!tag) throw redirect("/journal/archive");
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  const result = await catalogRepo.listPostsByTag(db, tag, { page });
  // The tag is free text from the URL: an empty one is a 404, not a thin indexable page.
  if (result.total === 0) throw new Response("Not found", { status: 404 });
  return { tag, result };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const label = data ? titleCase(data.tag) : "";
  return buildMeta({
    title: label,
    description: `Essays and close readings from the Foxing Journal tagged ${label.toLowerCase()}, on what the great books mean and why they endure.`,
    pathname: location.pathname,
    pageType: "CollectionPage",
    breadcrumbs: data
      ? [
          { name: SITE_NAME, path: "/" },
          { name: "Journal", path: "/journal" },
          { name: "All articles", path: "/journal/archive" },
          { name: label, path: location.pathname.replace(/\/+$/, "") },
        ]
      : undefined,
  });
}

export default function JournalTag({ loaderData }: Route.ComponentProps) {
  const { tag, result } = loaderData;
  const label = titleCase(tag);

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Journal", to: "/journal" },
            { label: "All articles", to: "/journal/archive" },
            { label: label },
          ]}
        />
        <PageHeader
          title={label}
          lede={`${result.total} ${result.total === 1 ? "post" : "posts"}`}
        />

        <div className="cap-stack" data-gap="8">
          {result.posts.length === 0 ? (
            <EmptyState title="Nothing here yet." />
          ) : (
            <div className="fx-journal-tag-grid">
              {result.posts.map((post) => (
                <JournalCard
                  key={post.slug}
                  to={`/journal/${post.slug}`}
                  label={post.tags?.[0]?.replace(/-/g, " ")}
                  title={post.title}
                  excerpt={post.excerpt}
                  minutes={post.readingTimeMinutes}
                />
              ))}
            </div>
          )}
          <Pager
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(n) => pageHref(journalTagPath(tag), {}, n)}
            prevLabel="Newer"
            nextLabel="Older"
            label="Journal pages"
          />
        </div>
      </Container>
    </PageShell>
  );
}
