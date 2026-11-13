import { catalogRepo } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { pageHref, parsePage } from "capsomer/behavior/pagination";
import { PageShell } from "~/components/page-shell";
import { Pager } from "~/components/pager";
import { Breadcrumbs, Container, EmptyState, PageHeader, TagPill } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, journalTagPath, SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/journal-archive";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const page = parsePage(new URL(request.url).searchParams.get("page"));
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
          trail={[
            { label: "Home", to: "/" },
            { label: "Journal", to: "/journal" },
            { label: "All articles" },
          ]}
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
                    <p className="cap-clamp fx-journal-archive-title" data-lines="1">
                      {post.title}
                    </p>
                    {post.excerpt ? (
                      <p className="cap-clamp fx-journal-archive-text" data-lines="1">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </div>
                  {post.tags?.[0] ? (
                    <span className="cap-keep fx-journal-archive-label">
                      {post.tags[0].replace(/-/g, " ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Pager
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={(n) => pageHref("/journal/archive", {}, n)}
          prevLabel="Newer"
          nextLabel="Older"
          label="Journal pages"
        />
      </Container>
    </PageShell>
  );
}
