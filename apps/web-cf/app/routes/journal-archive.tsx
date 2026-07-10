import { catalogRepo } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader, TagPill } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/journal-archive";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const [result, tags] = await Promise.all([
    catalogRepo.listPublishedPosts(db, { page, pageSize: 30 }),
    catalogRepo.listTags(db),
  ]);
  return { origin, result, tags };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(600, 86400);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return buildMeta({
    title: "All articles",
    description: "Every published essay from the Foxing Journal, browsable by tag.",
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

export default function JournalArchive({ loaderData }: Route.ComponentProps) {
  const { result, tags } = loaderData;

  return (
    <PageShell>
      <Container className="max-w-3xl">
        <p className="mb-6">
          <Link to="/journal" className="font-ui text-sm text-tertiary hover:text-primary">
            &larr; Journal
          </Link>
        </p>
        <PageHeader
          title="All articles"
          lede={`${result.total} ${result.total === 1 ? "article" : "articles"}`}
        />

        {tags.length > 0 ? (
          <div className="mb-10 flex flex-wrap gap-2">
            {tags.map((t) => (
              <TagPill key={t.tag} to={`/journal/tag/${t.tag}`}>
                {t.tag.replace(/-/g, " ")} &middot; {t.count}
              </TagPill>
            ))}
          </div>
        ) : null}

        {result.posts.length === 0 ? (
          <EmptyState title="No articles match those filters." />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {result.posts.map((post) => (
              <li key={post.slug}>
                <Link
                  to={`/journal/${post.slug}`}
                  className="group flex items-start justify-between gap-4 rounded-md px-2 py-4 -mx-2 transition-colors hover:bg-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base leading-snug text-primary transition-colors group-hover:text-brand-text">
                      {post.title}
                    </p>
                    {post.excerpt ? (
                      <p className="mt-0.5 truncate font-body text-sm text-secondary">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </div>
                  {post.tags?.[0] ? (
                    <span className="shrink-0 font-mono text-xs text-tertiary">
                      {post.tags[0].replace(/-/g, " ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
            {result.page > 1 ? (
              <Link
                to={`/journal/archive?page=${result.page - 1}`}
                rel="prev"
                className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
              >
                Newer
              </Link>
            ) : null}
            <span className="font-ui text-sm text-secondary">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link
                to={`/journal/archive?page=${result.page + 1}`}
                rel="next"
                className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
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
