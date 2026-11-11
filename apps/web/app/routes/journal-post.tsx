import { goneResponse, renameRedirect } from "@dustinedwards/site-runtime/url";
import { catalogRepo } from "@foxing/core";
import { journalPreviewContext } from "~/context";
import { PageShell } from "~/components/page-shell";
import { Picture } from "~/components/picture";
import { Breadcrumbs, Container, Eyebrow, TagPill } from "~/components/ui";
import { focalPosition } from "@dustinedwards/site-runtime/image";
import { renderJournalBody } from "~/lib/journal-body.server";
import { journalArticleImages, journalCovers } from "~/lib/journal-images.server";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { articleLd, buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/journal-post";
import { markup } from "capsomer/behavior/trusted-html";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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

  const [cover, articleImages, credits] = await Promise.all([
    post.coverImageUrl
      ? journalCovers(db, [post.coverImageUrl]).then((covers) =>
          covers.get(post.coverImageUrl ?? ""),
        )
      : undefined,
    // The Article's picture is the cover, else the share image Carrel set.
    journalArticleImages(db, post.coverImageUrl ?? post.ogImageUrl),
    catalogRepo.getJournalCredits(db, post),
  ]);

  return {
    html: await renderJournalBody(db, post.slug, post.content),
    cover,
    articleImages,
    preview: preview !== null,
    // The byline names a staff member only when the post credits one; otherwise it is Foxing's.
    author: credits.author,
    series: post.series
      ? {
          name: post.series,
          part: post.seriesPart,
          // A part past the live count (a later part published first) still reads sensibly.
          total: Math.max(credits.seriesTotal ?? 1, post.seriesPart ?? 1),
        }
      : null,
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
            {series ? (
              <p className="mt-2 fx-journal-post-row">
                {series.part
                  ? `Part ${series.part} of ${series.total} in ${series.name}`
                  : `Part of ${series.name}`}
              </p>
            ) : null}
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
              attrs={cover}
              alt={post.coverImageAlt ?? ""}
              className="mb-10 fx-journal-post-img"
              priority
              style={{ objectPosition: focalPosition(post.coverFocus) }}
            />
          ) : null}

          {/* Raw HTML: trusted CMS markdown. */}
          <div className="article-prose e-content" dangerouslySetInnerHTML={markup(html)} />
        </article>
      </Container>
    </PageShell>
  );
}
