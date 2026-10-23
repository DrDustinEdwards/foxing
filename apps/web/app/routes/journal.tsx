import { catalogRepo } from "@foxing/core";
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, Eyebrow, PageHeader, TagPill } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/journal";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await catalogRepo.listPublishedPosts(db, { page });
  return { origin, result };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return [
    ...buildMeta({
      title: "The Journal",
      description:
        "Essays and close readings from Foxing: what the great books mean and why they endure.",
      origin: data?.origin ?? "",
      pathname: location.pathname,
    }),
    { tagName: "link", rel: "alternate", type: "application/rss+xml", href: "/journal/rss.xml" },
  ];
}

export default function Journal({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  const [lead, ...rest] = result.posts;

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Reading, closely"
          title="The Journal"
          lede="Essays on the books in the library, and the ideas inside them."
        />
        <p className="-mt-6 mb-10">
          <Link to="/journal/archive" className="font-ui text-sm text-brand-text hover:underline">
            All articles
          </Link>
        </p>

        {result.posts.length === 0 ? (
          <EmptyState title="Nothing published yet" body="The first essays are on the way." />
        ) : (
          <div className="flex flex-col gap-12">
            {lead ? <LeadPost post={lead} /> : null}
            {rest.length > 0 ? (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            ) : null}
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
            {result.page > 1 ? (
              <Link
                to={`/journal?page=${result.page - 1}`}
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
                to={`/journal?page=${result.page + 1}`}
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

type Post = Route.ComponentProps["loaderData"]["result"]["posts"][number];

function LeadPost({ post }: { post: Post }) {
  return (
    <Link
      to={`/journal/${post.slug}`}
      className="group grid gap-6 rounded-hero border border-border-subtle bg-surface p-5 shadow-card-sm transition-shadow hover:shadow-card-md sm:p-8 md:grid-cols-2 md:items-center"
    >
      {post.coverImageUrl ? (
        <div className="overflow-hidden rounded-card">
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? ""}
            className="aspect-[16/10] w-full object-cover"
            loading="eager"
          />
        </div>
      ) : (
        <div className="aspect-[16/10] rounded-card bg-sunken" aria-hidden="true" />
      )}
      <div>
        <Eyebrow>{post.featured ? "Featured" : (fmtDate(post.publishedAt) ?? "Essay")}</Eyebrow>
        <h2 className="mt-2 font-display text-3xl leading-tight text-primary group-hover:text-brand-text">
          {post.title}
        </h2>
        {post.excerpt ? (
          <p className="mt-3 line-clamp-3 font-body text-lg text-secondary">{post.excerpt}</p>
        ) : null}
        <PostMeta post={post} />
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link
      to={`/journal/${post.slug}`}
      className="group flex flex-col rounded-card border border-border-subtle bg-surface p-4 shadow-card-sm transition-shadow hover:shadow-card-md"
    >
      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt={post.coverImageAlt ?? ""}
          className="mb-4 aspect-[16/10] w-full rounded-cover object-cover"
          loading="lazy"
        />
      ) : null}
      <h3 className="font-display text-xl leading-snug text-primary group-hover:text-brand-text">
        {post.title}
      </h3>
      {post.excerpt ? (
        <p className="mt-2 line-clamp-3 font-body text-secondary">{post.excerpt}</p>
      ) : null}
      <PostMeta post={post} />
    </Link>
  );
}

function PostMeta({ post }: { post: Post }) {
  const date = fmtDate(post.publishedAt);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 font-ui text-xs text-tertiary">
      {date ? <span>{date}</span> : null}
      {post.readingTimeMinutes ? (
        <>
          {date ? <span aria-hidden="true">·</span> : null}
          <span>{post.readingTimeMinutes} min read</span>
        </>
      ) : null}
      {post.tags?.slice(0, 1).map((t) => (
        <TagPill key={t}>{t}</TagPill>
      ))}
    </div>
  );
}
