import { catalogRepo } from "@foxing/core";
import { Link, redirect } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
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
  const { db, origin } = loaderBase(context, request);
  const tag = params.tag;
  if (!tag) throw redirect("/journal/archive");
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await catalogRepo.listPostsByTag(db, tag, { page });
  return { origin, tag, result };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(600, 86400);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const label = data ? tagLabel(data.tag) : "";
  return buildMeta({
    title: label,
    description: `Journal essays tagged ${label.toLowerCase()}.`,
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

export default function JournalTag({ loaderData }: Route.ComponentProps) {
  const { tag, result } = loaderData;
  const label = tagLabel(tag);

  return (
    <PageShell>
      <Container className="max-w-4xl">
        <p className="mb-6">
          <Link to="/journal/archive" className="font-ui text-sm text-tertiary hover:text-primary">
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.posts.map((post) => (
              <Link
                key={post.slug}
                to={`/journal/${post.slug}`}
                className="group flex flex-col rounded-card border border-border-subtle bg-surface p-5 shadow-card-sm transition-shadow hover:shadow-card-md"
              >
                {post.tags?.[0] ? (
                  <span className="mb-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                    {post.tags[0].replace(/-/g, " ")}
                  </span>
                ) : null}
                <h3 className="font-display text-lg leading-snug text-primary group-hover:text-brand-text">
                  {post.title}
                </h3>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-3 font-body text-secondary">{post.excerpt}</p>
                ) : null}
                {post.readingTimeMinutes ? (
                  <p className="mt-3 font-ui text-xs text-tertiary">
                    {post.readingTimeMinutes} min read
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
            {result.page > 1 ? (
              <Link
                to={`${journalTagPath(tag)}?page=${result.page - 1}`}
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
                to={`${journalTagPath(tag)}?page=${result.page + 1}`}
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
