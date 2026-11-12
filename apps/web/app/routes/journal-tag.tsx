import { catalogRepo } from "@foxing/core";
import { redirect } from "react-router";
import { Link } from "capsomer/react/link";
import { pageHref, parsePage } from "capsomer/behavior/pagination";
import { PageShell } from "~/components/page-shell";
import { Pager } from "~/components/pager";
import { Breadcrumbs, Container, EmptyState, PageHeader } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, journalTagPath, SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/journal-tag";

function tagLabel(tag: string): string {
  return tag
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const tag = params.tag;
  if (!tag) throw redirect("/journal/archive");
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  const result = await catalogRepo.listPostsByTag(db, tag, { page });
  return { tag, result };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const label = data ? tagLabel(data.tag) : "";
  return buildMeta({
    title: label,
    description: `Essays and close readings from the Foxing Journal tagged ${label.toLowerCase()}, on what the great books mean and why they endure.`,
    pathname: location.pathname,
    pageType: "CollectionPage",
    // The visible trail above the heading, from the home page down.
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
  const label = tagLabel(tag);

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

        {result.posts.length === 0 ? (
          <EmptyState title="Nothing here yet." />
        ) : (
          <div className="fx-journal-tag-grid">
            {result.posts.map((post) => (
              <Link key={post.slug} to={`/journal/${post.slug}`}>
                <article className="cap-card fx-journal-tag-card">
                  {post.tags?.[0] ? (
                    <span className="mb-2 fx-journal-tag-caps">
                      {post.tags[0].replace(/-/g, " ")}
                    </span>
                  ) : null}
                  <h3 className="fx-journal-tag-title">{post.title}</h3>
                  {post.excerpt ? <p className="mt-2 fx-journal-tag-text">{post.excerpt}</p> : null}
                  {post.readingTimeMinutes ? (
                    <p className="mt-3 fx-journal-tag-text-2">{post.readingTimeMinutes} min read</p>
                  ) : null}
                </article>
              </Link>
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
      </Container>
    </PageShell>
  );
}
