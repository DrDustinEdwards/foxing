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
  const { db } = loaderBase(context, request);
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await catalogRepo.listPublishedPosts(db, { page });
  return { result };
}

export const headers = listingPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return [
    ...buildMeta({
      title: "The Journal",
      description:
        "Essays and close readings from Foxing: what the great books mean and why they endure.",
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
        <p className="mb-10 fx-journal-text">
          <Link to="/journal/archive" className="link sans small">
            All articles
          </Link>
        </p>

        {result.posts.length === 0 ? (
          <EmptyState title="Nothing published yet" body="The first essays are on the way." />
        ) : (
          <div className="fx-journal-stack">
            {lead ? <LeadPost post={lead} /> : null}
            {rest.length > 0 ? (
              <div className="fx-journal-grid">
                {rest.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            ) : null}
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-12 justify-center fx-journal-row">
            {result.page > 1 ? (
              <Link to={`/journal?page=${result.page - 1}`} rel="prev" className="cap-btn">
                Newer
              </Link>
            ) : null}
            <span className="ui">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link to={`/journal?page=${result.page + 1}`} rel="next" className="cap-btn">
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
    <Link to={`/journal/${post.slug}`} className="group fx-journal-card">
      {post.coverImageUrl ? (
        <div className="fx-journal-box">
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? ""}
            className="fx-journal-img"
            loading="eager"
          />
        </div>
      ) : (
        <div className="fx-journal-box-2" aria-hidden="true" />
      )}
      <div>
        <Eyebrow>{post.featured ? "Featured" : (fmtDate(post.publishedAt) ?? "Essay")}</Eyebrow>
        <h2 className="mt-2 fx-journal-title">{post.title}</h2>
        {post.excerpt ? <p className="mt-3 fx-journal-text-2">{post.excerpt}</p> : null}
        <PostMeta post={post} />
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/journal/${post.slug}`} className="group fx-journal-card-2">
      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt={post.coverImageAlt ?? ""}
          className="mb-4 fx-journal-img-2"
          loading="lazy"
        />
      ) : null}
      <h3 className="fx-journal-title-2">{post.title}</h3>
      {post.excerpt ? <p className="mt-2 fx-journal-text-3">{post.excerpt}</p> : null}
      <PostMeta post={post} />
    </Link>
  );
}

function PostMeta({ post }: { post: Post }) {
  const date = fmtDate(post.publishedAt);
  return (
    <div className="mt-4 fx-journal-row-2">
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
