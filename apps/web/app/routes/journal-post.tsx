import { catalogRepo } from "@foxing/core";
import { marked } from "marked";
import { journalPreviewContext } from "~/context";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Container, Eyebrow, TagPill } from "~/components/ui";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { articleLd, breadcrumbLd, buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/journal-post";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  // The Carrel preview sets an unsaved post in-process; an ordinary request never has one.
  const post =
    context.get(journalPreviewContext) ?? (await catalogRepo.getPostBySlug(db, params.slug));
  if (!post) throw new Response("Not found", { status: 404 });

  // Journal content is trusted, admin-authored Markdown (CMS). Render at the edge.
  const html = marked.parse(post.content, { async: false, gfm: true }) as string;

  return {
    origin,
    html,
    post: {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      coverImageAlt: post.coverImageAlt,
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
  const { post, origin } = data;
  const meta = buildMeta({
    title: post.ogTitle ?? post.title,
    description: post.ogDescription ?? post.excerpt ?? `${post.title}, from the Foxing Journal.`,
    origin,
    pathname: location.pathname,
    image: post.coverImageUrl ?? undefined,
    imageAlt: post.coverImageAlt ?? undefined,
    type: "article",
  });
  return [
    ...meta,
    ldJson(
      articleLd(origin, {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        coverImageUrl: post.coverImageUrl,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
      }),
    ),
    ldJson(
      breadcrumbLd(origin, [
        { name: "Home", path: "/" },
        { name: "Journal", path: "/journal" },
        { name: post.title, path: `/journal/${post.slug}` },
      ]),
    ),
  ];
}

export default function JournalPost({ loaderData }: Route.ComponentProps) {
  const { post, html } = loaderData;
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
        <article>
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

          {post.coverImageUrl ? (
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? ""}
              className="mb-10 fx-journal-post-img"
              loading="eager"
            />
          ) : null}

          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted CMS markdown */}
          <div className="article-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </Container>
    </PageShell>
  );
}
