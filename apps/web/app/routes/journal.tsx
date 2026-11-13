import type { ImageAttributes } from "@dustinedwards/site-runtime/image";
import { catalogRepo } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { pageHref, parsePage } from "capsomer/behavior/pagination";
import { PageShell } from "~/components/page-shell";
import { Pager } from "~/components/pager";
import { Picture } from "capsomer/react/picture";
import { Container, EmptyState, Eyebrow, PageHeader, TagPill } from "~/components/ui";
import { pictureProps } from "@dustinedwards/site-runtime/image";
import { formatLongDate } from "~/lib/dates";
import { journalCovers } from "~/lib/journal-images.server";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { buildMeta, journalLd } from "~/lib/seo";
import type { Route } from "./+types/journal";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  const result = await catalogRepo.listPublishedPosts(db, { page });
  const covers = await journalCovers(
    db,
    result.posts.map((p) => p.coverImageUrl),
  );
  return { result, covers: Object.fromEntries(covers) };
}

export const headers = listingPageHeaders;

const JOURNAL_DESCRIPTION =
  "Essays and close readings from Foxing: what the great books mean and why they endure.";

export function meta({ location }: Route.MetaArgs) {
  return [
    ...buildMeta({
      title: "The Journal",
      description: JOURNAL_DESCRIPTION,
      pathname: location.pathname,
      pageType: "CollectionPage",
    }),
    jsonLd(journalLd(JOURNAL_DESCRIPTION)),
    { tagName: "link", rel: "alternate", type: "application/rss+xml", href: "/journal/rss.xml" },
  ];
}

export default function Journal({ loaderData }: Route.ComponentProps) {
  const { result, covers } = loaderData;
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
          <Link to="/journal/archive" className="cap-text link" data-size="small" data-face="ui">
            All articles
          </Link>
        </p>

        {result.posts.length === 0 ? (
          <EmptyState title="Nothing published yet" body="The first essays are on the way." />
        ) : (
          <div className="fx-journal-stack">
            {lead ? <LeadPost post={lead} cover={covers[lead.coverImageUrl ?? ""]} /> : null}
            {rest.length > 0 ? (
              <div className="fx-journal-grid">
                {rest.map((p) => (
                  <PostCard key={p.slug} post={p} cover={covers[p.coverImageUrl ?? ""]} />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <Pager
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={(n) => pageHref("/journal", {}, n)}
          prevLabel="Newer"
          nextLabel="Older"
          label="Journal pages"
        />
      </Container>
    </PageShell>
  );
}

type Post = Route.ComponentProps["loaderData"]["result"]["posts"][number];

function LeadPost({ post, cover }: { post: Post; cover?: ImageAttributes }) {
  return (
    <Link to={`/journal/${post.slug}`}>
      <div className="cap-card fx-journal-card">
        {cover ? (
          <div className="fx-journal-box">
            <Picture
              picture={pictureProps(cover, {
                alt: post.coverImageAlt ?? "",
                priority: true,
                className: "fx-journal-img",
                focus: post.coverFocus,
              })}
            />
          </div>
        ) : (
          <div className="fx-journal-box-2" aria-hidden="true" />
        )}
        <div>
          <Eyebrow>
            {post.featured ? "Featured" : (formatLongDate(post.publishedAt) ?? "Essay")}
          </Eyebrow>
          <h2 className="mt-2 fx-journal-title">{post.title}</h2>
          {post.excerpt ? <p className="mt-3 fx-journal-text-2">{post.excerpt}</p> : null}
          <PostMeta post={post} />
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post, cover }: { post: Post; cover?: ImageAttributes }) {
  return (
    <Link to={`/journal/${post.slug}`}>
      <div className="cap-card fx-journal-card-2">
        {cover ? (
          <Picture
            picture={pictureProps(
              { ...cover, sizes: "(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw" },
              {
                alt: post.coverImageAlt ?? "",
                className: "mb-4 fx-journal-img-2",
                focus: post.coverFocus,
              },
            )}
          />
        ) : null}
        <h3 className="fx-journal-title-2">{post.title}</h3>
        {post.excerpt ? <p className="mt-2 fx-journal-text-3">{post.excerpt}</p> : null}
        <PostMeta post={post} />
      </div>
    </Link>
  );
}

function PostMeta({ post }: { post: Post }) {
  const date = formatLongDate(post.publishedAt);
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
