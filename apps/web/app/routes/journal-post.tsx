import { goneResponse, renameRedirect } from "@dustinedwards/site-runtime/url";
import { catalogRepo } from "@foxing/core";
import { journalPreviewContext } from "~/context";
import { PageShell } from "~/components/page-shell";
import { Picture } from "capsomer/react/picture";
import { Breadcrumbs, Container, Eyebrow, TagPill } from "~/components/ui";
import { pictureProps } from "@dustinedwards/site-runtime/image";
import { renderJournalBody } from "~/lib/journal-body.server";
import { journalArticleImages, journalCovers } from "~/lib/journal-images.server";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { articleLd, buildMeta, journalSeriesPath, ldJson } from "~/lib/seo";
import { SeriesNav } from "capsomer/react/series-nav";
import "~/styles/journal-series.css";
import type { Route } from "./+types/journal-post";
import { markup } from "capsomer/behavior/trusted-html";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// The series nav's parts: the live posts of the series in reading order. A Carrel preview of a part
// not yet live joins at its part number, so the preview shows the nav the post will have.
function seriesNav(
  post: { slug: string; title: string; series: string | null; seriesPart: number | null },
  live: Array<{ slug: string; title: string; seriesPart: number | null }>,
) {
  const parts = live.some((p) => p.slug === post.slug)
    ? live
    : [...live, post].sort(
        (a, b) =>
          (a.seriesPart ?? Number.POSITIVE_INFINITY) - (b.seriesPart ?? Number.POSITIVE_INFINITY),
      );
  return {
    name: post.series ?? "",
    href: journalSeriesPath(post.series ?? ""),
    current: `/journal/${post.slug}`,
    parts: parts.map((p) => ({ href: `/journal/${p.slug}`, title: p.title })),
  };
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  // A Carrel preview hands the route its post; every other render reads the live one.
  const preview = context.get(journalPreviewContext);
  const post = preview ?? (await catalogRepo.getPostBySlug(db, params.slug));
  if (!post) {
    // A post Carrel renamed: its old address answers a permanent redirect to the new one (site-api's
    // rename), through site-runtime's renameRedirect, which follows a chain of renames in one hop.
    // Read only on a miss, so a live post's page costs no extra query.
    const moved = await renameRedirect(request, {
      prefix: "/journal/",
      renames: (slug) => catalogRepo.getJournalSlugRedirect(db, slug),
    });
    if (moved) throw moved;
    // A post taken down on purpose (trashed after it was live) is gone, 410, not missing.
    if (await catalogRepo.isJournalPostWithdrawn(db, params.slug)) {
      throw (
        goneResponse(request, [`/journal/${params.slug}`]) ??
        new Response("Not found", { status: 404 })
      );
    }
    throw new Response("Not found", { status: 404 });
  }

  const [cover, articleImages, author, seriesParts] = await Promise.all([
    post.coverImageUrl
      ? journalCovers(db, [post.coverImageUrl]).then((covers) =>
          covers.get(post.coverImageUrl ?? ""),
        )
      : undefined,
    // The Article's picture is the cover, else the share image Carrel set.
    journalArticleImages(db, post.coverImageUrl ?? post.ogImageUrl),
    catalogRepo.getJournalAuthor(db, post),
    post.series ? catalogRepo.listJournalSeriesParts(db, post.series) : [],
  ]);

  return {
    html: await renderJournalBody(db, post.slug, post.content),
    cover,
    articleImages,
    preview: preview !== null,
    // The byline names a staff member only when the post credits one; otherwise it is Foxing's.
    author,
    series: post.series ? seriesNav(post, seriesParts) : null,
    post: {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      coverImageAlt: post.coverImageAlt,
      coverFocus: post.coverFocus,
      tags: post.tags,
      readingTimeMinutes: post.readingTimeMinutes,
      publishedAt: post.showPublishedAt ? post.publishedAt : null,
      updatedAt: post.showUpdatedAt ? post.updatedAt : null,
      ogTitle: post.ogTitle,
      ogDescription: post.ogDescription,
      canonicalUrl: post.canonicalUrl,
      ogImageUrl: post.ogImageUrl,
      ogImageAlt: post.ogImageAlt,
      noindex: post.noindex,
    },
  };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Essay not found | Foxing" }];
  const { post, articleImages, author } = data;
  const meta = buildMeta({
    title: post.ogTitle ?? post.title,
    description: post.ogDescription ?? post.excerpt ?? `${post.title}, from the Foxing Journal.`,
    pathname: location.pathname,
    // Carrel's share image (site-api's image and imageAlt search fields) ahead of the cover.
    image: post.ogImageUrl ?? post.coverImageUrl ?? undefined,
    imageAlt: (post.ogImageUrl ? post.ogImageAlt : post.coverImageAlt) ?? undefined,
    canonical: post.canonicalUrl ?? undefined,
    noindex: post.noindex,
    type: "article",
  });
  return [
    // A preview is never indexed, whatever headers carry it.
    ...(data.preview
      ? [
          ...meta.filter((m) => !("name" in m && m.name === "robots")),
          { name: "robots", content: "noindex" },
        ]
      : meta),
    ldJson(
      articleLd({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImageUrl: post.coverImageUrl,
        articleImages,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        author,
      }),
    ),
  ];
}

export default function JournalPost({ loaderData }: Route.ComponentProps) {
  const { post, html, cover, author, series } = loaderData;
  const published = fmtDate(post.publishedAt);

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Journal", to: "/journal" },
            { label: post.title },
          ]}
        />
        {/* h-entry and e-content name the post's own text for site-api's webmention hook, which
            sends to the links inside it only. No style reads either class. */}
        <article className="h-entry">
          <header className="mb-8">
            <Eyebrow>The Journal</Eyebrow>
            <h1 className="mt-3 fx-journal-post-title">{post.title}</h1>
            <div className="mt-4 fx-journal-post-row">
              {author ? (
                <span>
                  By <span className="p-author h-card">{author}</span>
                </span>
              ) : null}
              {author && published ? <span aria-hidden="true">·</span> : null}
              {published ? <span>{published}</span> : null}
              {post.readingTimeMinutes ? (
                <>
                  {author || published ? <span aria-hidden="true">·</span> : null}
                  <span>{post.readingTimeMinutes} min read</span>
                </>
              ) : null}
              {post.tags?.map((t) => (
                <TagPill key={t}>{t}</TagPill>
              ))}
            </div>
          </header>

          {cover ? (
            <Picture
              picture={pictureProps(cover, {
                alt: post.coverImageAlt ?? "",
                priority: true,
                className: "mb-10 fx-journal-post-img",
                focus: post.coverFocus,
              })}
            />
          ) : null}

          {series ? <SeriesNav {...series} /> : null}

          {/* Raw HTML: trusted CMS markdown. */}
          <div className="article-prose e-content" dangerouslySetInnerHTML={markup(html)} />
        </article>
      </Container>
    </PageShell>
  );
}
