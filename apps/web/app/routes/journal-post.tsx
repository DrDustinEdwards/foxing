import { goneResponse, renameRedirect } from "@dustinedwards/site-runtime/url";
import { catalogRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Picture } from "~/components/picture";
import { Breadcrumbs, Container, Eyebrow, TagPill } from "~/components/ui";
import { focusStyle } from "~/lib/focus";
import { renderJournalBody } from "~/lib/journal-body.server";
import { journalCovers } from "~/lib/journal-images.server";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { articleLd, buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/journal-post";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const post = await catalogRepo.getPostBySlug(db, params.slug);
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

  const cover = post.coverImageUrl
    ? (await journalCovers(db, [post.coverImageUrl])).get(post.coverImageUrl)
    : undefined;

  return {
    html: await renderJournalBody(db, post.slug, post.content),
    cover,
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
    },
  };
}

export const headers = listingPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Essay not found | Foxing" }];
  const { post } = data;
  const meta = buildMeta({
    title: post.ogTitle ?? post.title,
    description: post.ogDescription ?? post.excerpt ?? `${post.title}, from the Foxing Journal.`,
    pathname: location.pathname,
    image: post.coverImageUrl ?? undefined,
    imageAlt: post.coverImageAlt ?? undefined,
    type: "article",
  });
  return [
    ...meta,
    ldJson(
      articleLd({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImageUrl: post.coverImageUrl,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
      }),
    ),
  ];
}

export default function JournalPost({ loaderData }: Route.ComponentProps) {
  const { post, html, cover } = loaderData;
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
              {published ? <span>{published}</span> : null}
              {post.readingTimeMinutes ? (
                <>
                  {published ? <span aria-hidden="true">·</span> : null}
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
              style={focusStyle(post.coverFocus)}
            />
          ) : null}

          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted CMS markdown */}
          <div className="article-prose e-content" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </Container>
    </PageShell>
  );
}
