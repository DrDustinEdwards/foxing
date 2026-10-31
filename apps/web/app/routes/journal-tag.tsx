import { catalogRepo } from "@foxing/core";
import { redirect } from "react-router";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, journalTagPath } from "~/lib/seo";
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
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await catalogRepo.listPostsByTag(db, tag, { page });
  return { tag, result };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const label = data ? tagLabel(data.tag) : "";
  return buildMeta({
    title: label,
    description: `Journal essays tagged ${label.toLowerCase()}.`,
    pathname: location.pathname,
    pageType: "CollectionPage",
  });
}

export default function JournalTag({ loaderData }: Route.ComponentProps) {
  const { tag, result } = loaderData;
  const label = tagLabel(tag);

  return (
    <PageShell>
      <Container>
        <p className="mb-6">
          <Link to="/journal/archive" className="fx-journal-tag-link">
            &larr; All articles
          </Link>
        </p>
        <PageHeader
          title={label}
          lede={`${result.total} ${result.total === 1 ? "post" : "posts"}`}
        />

        {result.posts.length === 0 ? (
          <EmptyState title="Nothing here yet." />
        ) : (
          <div className="fx-journal-tag-grid">
            {result.posts.map((post) => (
              <Link
                key={post.slug}
                to={`/journal/${post.slug}`}
                className="group fx-journal-tag-card"
              >
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
              </Link>
            ))}
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-12 justify-center fx-journal-tag-row">
            {result.page > 1 ? (
              <Link
                to={`${journalTagPath(tag)}?page=${result.page - 1}`}
                rel="prev"
                className="cap-btn"
              >
                Newer
              </Link>
            ) : null}
            <span className="ui">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link
                to={`${journalTagPath(tag)}?page=${result.page + 1}`}
                rel="next"
                className="cap-btn"
              >
                Older
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Container>
    </PageShell>
  );
}
