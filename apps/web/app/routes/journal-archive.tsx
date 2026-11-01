import { catalogRepo } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Container, EmptyState, PageHeader, TagPill } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, journalTagPath, SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/journal-archive";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const [result, tags] = await Promise.all([
    catalogRepo.listPublishedPosts(db, { page, pageSize: 30 }),
    catalogRepo.listTags(db),
  ]);
  return { result, tags };
}

export const headers = listingPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return buildMeta({
    title: "All articles",
    description:
      "Every published essay and close reading from the Foxing Journal, on the great books and why they endure, browsable by tag.",
    pathname: location.pathname,
    pageType: "CollectionPage",
    // The visible trail above the heading, from the home page down.
    breadcrumbs: [
      { name: SITE_NAME, path: "/" },
      { name: "Journal", path: "/journal" },
      { name: "All articles", path: "/journal/archive" },
    ],
  });
}

export default function JournalArchive({ loaderData }: Route.ComponentProps) {
  const { result, tags } = loaderData;

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[{ label: "Home", to: "/" }, { label: "Journal", to: "/journal" }, { label: "All articles" }]}
        />
        <PageHeader
          title="All articles"
          lede={`${result.total} ${result.total === 1 ? "article" : "articles"}`}
        />

        {tags.length > 0 ? (
          <div className="mb-10 fx-journal-archive-row">
            {tags.map((t) => (
              <TagPill key={t.tag} to={journalTagPath(t.tag)}>
                {t.tag.replace(/-/g, " ")} &middot; {t.count}
              </TagPill>
            ))}
          </div>
        ) : null}

        {result.posts.length === 0 ? (
          <EmptyState title="No articles match those filters." />
        ) : (
          <ul className="fx-journal-archive-stack">
            {result.posts.map((post) => (
              <li key={post.slug}>
                <Link
                  to={`/journal/${post.slug}`}
                  className="group items-start py-4 fx-journal-archive-link-2"
                >
                  <div className="fx-journal-archive-box">
                    <p className="truncate fx-journal-archive-title">{post.title}</p>
                    {post.excerpt ? (
                      <p className="truncate fx-journal-archive-text">{post.excerpt}</p>
                    ) : null}
                  </div>
                  {post.tags?.[0] ? (
                    <span className="shrink-0 fx-journal-archive-label">
                      {post.tags[0].replace(/-/g, " ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-12 justify-center row-4">
            {result.page > 1 ? (
              <Link to={`/journal/archive?page=${result.page - 1}`} rel="prev" className="cap-btn">
                Newer
              </Link>
            ) : null}
            <span className="ui">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link to={`/journal/archive?page=${result.page + 1}`} rel="next" className="cap-btn">
                Older
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Container>
    </PageShell>
  );
}
