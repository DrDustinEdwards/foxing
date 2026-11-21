import { preloads } from "@dustinedwards/site-runtime/preload";
import { renameRedirect } from "@dustinedwards/site-runtime/url";
import { useMyBook, useShelves } from "@foxing/client";
import { catalogRepo, views } from "@foxing/core";
import { ButtonLink, Link } from "capsomer/react/link";
import { BookCard, BookGrid } from "~/components/book-card";
import { BookShelvesPicker } from "~/components/book-shelves-picker";
import { BookStatusControl } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Button, Chip, Container, TagPill } from "~/components/ui";
import { sessionUserFromRequest } from "~/lib/auth.server";
import { coverAttributes } from "~/lib/images";
import { affiliateConfig, catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import { render } from "@drdustinedwards/site-helpers/render/nomath";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { excerpt, htmlToText } from "@drdustinedwards/site-helpers/text";
import { markup } from "capsomer/behavior/trusted-html";
import { bookLd, buildMeta } from "~/lib/seo";
import { data } from "react-router";
import type { Route } from "./+types/book-detail";
import { signInHref } from "~/lib/sign-in-path";

/**
 * The LCP cover's preload for the Link header, so Early Hints starts it before the HTML arrives
 * (site-runtime ./preload). None with a srcset, whose width the browser picks, and none for a
 * cover URL a Link header cannot carry (preloads refuses it), which would otherwise fail the page.
 */
/** Catalog text (Markdown: paragraphs, the odd list or bold title) as HTML, through Prelum's render, which drops raw HTML. */
async function textHtml(body: string | null): Promise<string | null> {
  if (!body) return null;
  const { html } = await render({ file: "book-text", body, resolveImage: async () => null });
  return html;
}

function coverLink(src: string | null): string {
  const attrs = src ? coverAttributes(src) : null;
  if (!attrs || attrs.srcset) return "";
  try {
    return preloads([{ href: attrs.src, as: "image" }]).header;
  } catch {
    return "";
  }
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env } = loaderBase(context, request);
  const page = await views.bookPage(db, params.slug, affiliateConfig(env));
  if (!page) throw new Response("Not found", { status: 404 });
  if (page.book.slug !== params.slug) {
    // Found by its id, or by a slug that is not its own: one 301 to the book's own address
    // (site-runtime's renameRedirect), so each book keeps one URL and an old link still lands.
    const canonical = page.book.slug;
    const moved = await renameRedirect(request, {
      prefix: "/books/",
      renames: (slug) => (slug === params.slug ? canonical : null),
    });
    throw moved ?? new Response("Not found", { status: 404 });
  }
  const { book, awards, related } = page;
  const readable = book.readable;
  const community = book.community;

  // Personalized shelf status + shelves. Anonymous requests are edge-cached (this
  // loader does not run), so this only fires for signed-in readers (cache bypassed).
  const user = await sessionUserFromRequest(request, env);
  const userId = user?.id ?? null;
  const [myBook, shelves] = userId
    ? await Promise.all([views.myBook(db, userId, book.id), views.shelves(db, userId)])
    : [undefined, []];

  // The catalog's own description first (the generated one only where the catalog's was filler or empty), and the
  // generated notes on the author, the reading order and books like it.
  const [descriptionHtml, authorBio, readingOrder, similarBooks] = await Promise.all([
    textHtml(book.description ?? page.ai.description),
    textHtml(page.ai.authorBio),
    textHtml(page.ai.readingOrder),
    textHtml(page.ai.similarBooks),
  ]);

  const link = coverLink(book.coverUrl);
  return data(
    {
      community,
      readable,
      awards,
      related,
      signedIn: !!userId,
      myBook,
      shelves,
      bookId: book.id,
      loginHref: signInHref(`/books/${book.slug}`),
      buys: page.buys,
      descriptionHtml,
      notes: [
        { id: "author", title: `About ${book.author}`, html: authorBio },
        { id: "reading-order", title: "Reading order", html: readingOrder },
        { id: "similar", title: "If you like this", html: similarBooks },
      ].filter((n): n is { id: string; title: string; html: string } => n.html !== null),
      book: {
        slug: book.slug,
        title: book.title,
        author: book.author,
        authorSlug: book.authorSlug,
        // Plain text for the meta description and the JSON-LD.
        description: descriptionHtml ? htmlToText(descriptionHtml) : null,
        coverUrl: book.coverUrl,
        publicationYear: book.publicationYear,
        language: book.language,
        wordCount: book.wordCount,
        subjects: book.subjects,
        isbn13: book.isbn13,
        publisher: book.publisher,
      },
    },
    link ? { headers: { Link: link } } : undefined,
  );
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => {
  const link = loaderHeaders.get("Link");
  return { ...catalogPageHeaders(), ...(link ? { Link: link } : {}) };
};

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Book not found | Foxing" }];
  const { book, community } = data;
  const description =
    (book.description ? excerpt(book.description, 200) : null) ??
    `${book.title} by ${book.author} on Foxing. Read the classics and track your reading.`;
  return [
    ...buildMeta({
      title: `${book.title} by ${book.author}`,
      description,
      pathname: location.pathname,
      // The share card (routes/og-book.tsx), drawn at site-runtime's 1200x630.
      image: { url: `/og/book/${book.slug}`, width: 1200, height: 630, type: "image/png" },
      imageAlt: `${book.title} by ${book.author}`,
      type: "book",
      noindex: community,
    }),
    jsonLd(bookLd(book)),
  ];
}

function readingTime(words: number | null): string | null {
  if (!words) return null;
  const hours = words / (250 * 60);
  if (hours < 1) return `${Math.max(1, Math.round(words / 250))} min read`;
  return `${hours.toFixed(1)} hours`;
}

export default function BookDetail({ loaderData }: Route.ComponentProps) {
  const { book, awards, related, buys, readable, descriptionHtml, notes } = loaderData;
  const { signedIn, bookId, loginHref } = loaderData;
  // The reader's state for this book lives in the cache, so a status or shelf change
  // shows at once and survives navigating away and back.
  const mine = useMyBook(bookId, loaderData.myBook, signedIn).data;
  const shelves = useShelves(loaderData.shelves).data;
  const time = readingTime(book.wordCount);

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="9">
        <div className="cap-stack" data-gap="6">
          <Breadcrumbs
            trail={[
              { label: "Home", to: "/" },
              { label: "Books", to: "/books" },
              { label: book.title },
            ]}
          />

          <div className="fx-book-detail-grid">
            {/* Cover column (LCP). */}
            <div className="cap-stack fx-book-detail-box" data-gap="6">
              <div className="fx-book-detail-box-2">
                <CoverImage
                  src={book.coverUrl}
                  alt={`Cover of ${book.title} by ${book.author}`}
                  fallbackLabel={book.title}
                  priority
                  sizes="(min-width: 64rem) 260px, 60vw"
                />
              </div>
              <div className="fx-book-detail-stack">
                {readable ? (
                  <Button to={`/read/${book.slug}`} variant="primary">
                    Read now
                  </Button>
                ) : null}
                <BookStatusControl
                  book={{
                    id: bookId,
                    slug: book.slug,
                    title: book.title,
                    author: book.author,
                    coverUrl: book.coverUrl,
                  }}
                  currentStatus={mine?.status ?? null}
                  signedIn={signedIn}
                  loginHref={loginHref}
                />
                {signedIn ? (
                  <BookShelvesPicker
                    bookId={bookId}
                    shelves={shelves}
                    memberOf={mine?.shelfIds ?? []}
                  />
                ) : null}
                {buys.map((b) => (
                  <ButtonLink
                    key={b.retailer}
                    href={b.url}
                    variant={b.retailer === "bookshop" ? "secondary" : "quiet"}
                    className={b.retailer === "bookshop" ? undefined : "fx-btn-ghost"}
                    away
                    newTab
                    sponsored={b.sponsored}
                  >
                    {b.retailer === "library" ? b.label : `Buy at ${b.label}`}
                  </ButtonLink>
                ))}
              </div>
            </div>

            {/* Detail column. */}
            <div className="cap-stack" data-gap="7">
              <div className="cap-stack" data-gap="6">
                <div className="cap-stack" data-gap="4">
                  <h1 className="fx-book-detail-title">{book.title}</h1>
                  <p className="fx-book-detail-text">
                    by{" "}
                    {book.authorSlug ? (
                      <Link to={`/authors/${book.authorSlug}`} className="link">
                        {book.author}
                      </Link>
                    ) : (
                      book.author
                    )}
                  </p>
                </div>

                <div className="fx-book-detail-row">
                  {book.publicationYear ? <Chip>{book.publicationYear}</Chip> : null}
                  {time ? <Chip>{time}</Chip> : null}
                  {book.publisher ? <Chip>{book.publisher}</Chip> : null}
                </div>

                {awards.length > 0 ? (
                  <div className="cap-card">
                    <ul className="fx-book-detail-stack-2">
                      {awards.map((a) => (
                        <li
                          key={`${a.awardSlug}-${a.year}`}
                          className="cap-text"
                          data-size="small"
                          data-face="ui"
                        >
                          <Link to={`/awards/${a.awardSlug}`} className="link">
                            {a.awardName}
                          </Link>
                          <span className="cap-text" data-tone="dim">
                            {a.year ? `, ${a.year}` : ""} · {a.distinction}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {descriptionHtml ? (
                <div
                  className="cap-stack fx-book-detail-box-3"
                  data-gap="5"
                  dangerouslySetInnerHTML={markup(descriptionHtml)}
                />
              ) : null}

              {notes.length > 0 ? (
                <div className="fx-book-detail-notes">
                  {notes.map((n) => (
                    <details key={n.id}>
                      <summary>{n.title}</summary>
                      <div className="article-prose" dangerouslySetInnerHTML={markup(n.html)} />
                    </details>
                  ))}
                </div>
              ) : null}

              {book.subjects.length > 0 ? (
                <div className="cap-stack" data-gap="4">
                  <div className="cap-cluster" data-gap="3">
                    {book.subjects.map((s) => (
                      <TagPill key={s} to={`/books?subject=${encodeURIComponent(s)}`}>
                        {catalogRepo.genreLabel(s)}
                      </TagPill>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="cap-stack" data-gap="6">
            <h2 className="fx-book-detail-title-2">More like this</h2>
            <BookGrid>
              {related.map((b) => (
                <BookCard key={b.slug} book={b} />
              ))}
            </BookGrid>
          </section>
        ) : null}
      </Container>
    </PageShell>
  );
}

export { ErrorBoundary } from "~/components/route-error";
