import { useMyBook, useShelves } from "@foxing/client";
import { views } from "@foxing/core";
import { Link } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { BookShelvesPicker } from "~/components/book-shelves-picker";
import { BookStatusControl } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Button, Chip, Container, Eyebrow, TagPill } from "~/components/ui";
import { getAuth } from "~/lib/auth.server";
import { affiliateConfig, catalogPageHeaders, loaderBase } from "~/lib/loader.server";
import { bookLd, breadcrumbLd, buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/book-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env } = loaderBase(context, request);
  const page = await views.bookPage(db, params.slug, affiliateConfig(env));
  if (!page || page.book.slug !== params.slug) throw new Response("Not found", { status: 404 });
  const { book, awards, related } = page;
  const readable = book.readable;
  const community = book.community;

  // Personalized shelf status + shelves. Anonymous requests are edge-cached (this
  // loader does not run), so this only fires for signed-in readers (cache bypassed).
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  const [myBook, shelves] = userId
    ? await Promise.all([views.myBook(db, userId, book.id), views.shelves(db, userId)])
    : [undefined, []];

  return {
    community,
    readable,
    awards,
    related,
    signedIn: !!userId,
    myBook,
    shelves,
    bookId: book.id,
    loginHref: `/login?redirect=/books/${book.slug}`,
    buys: page.buys,
    book: {
      slug: book.slug,
      title: book.title,
      author: book.author,
      authorSlug: book.authorSlug,
      description: book.description,
      coverUrl: book.coverUrl,
      publicationYear: book.publicationYear,
      language: book.language,
      wordCount: book.wordCount,
      subjects: book.subjects,
      isbn13: book.isbn13,
      publisher: book.publisher,
    },
  };
}

export const headers = catalogPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Book not found | Foxing" }];
  const { book, community } = data;
  const description =
    book.description?.slice(0, 200) ??
    `${book.title} by ${book.author} on Foxing. Read the classics and track your reading.`;
  return [
    ...buildMeta({
      title: `${book.title} by ${book.author}`,
      description,
      pathname: location.pathname,
      image: `/og/book/${book.slug}`,
      imageAlt: `${book.title} by ${book.author}`,
      type: "book",
      noindex: community,
    }),
    ldJson(bookLd(book)),
    ldJson(
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Books", path: "/books" },
        { name: book.title, path: `/books/${book.slug}` },
      ]),
    ),
  ];
}

function readingTime(words: number | null): string | null {
  if (!words) return null;
  const hours = words / (250 * 60);
  if (hours < 1) return `${Math.max(1, Math.round(words / 250))} min read`;
  return `${hours.toFixed(1)} hours`;
}

export default function BookDetail({ loaderData }: Route.ComponentProps) {
  const { book, awards, related, buys, readable, community } = loaderData;
  const { signedIn, bookId, loginHref } = loaderData;
  // The reader's state for this book lives in the cache, so a status or shelf change
  // shows at once and survives navigating away and back.
  const mine = useMyBook(bookId, loaderData.myBook, signedIn).data;
  const shelves = useShelves(loaderData.shelves).data;
  const time = readingTime(book.wordCount);

  return (
    <PageShell>
      <Container>
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Books", to: "/books" },
            { label: book.title },
          ]}
        />

        <div className="fx-book-detail-grid">
          {/* Cover column (LCP). */}
          <div className="fx-book-detail-box">
            <div className="fx-book-detail-box-2">
              <CoverImage
                src={book.coverUrl}
                alt={`Cover of ${book.title} by ${book.author}`}
                fallbackLabel={book.title}
                priority
                sizes="(min-width: 1024px) 260px, 60vw"
              />
            </div>
            <div className="mt-5 fx-book-detail-stack">
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
                <Button
                  key={b.retailer}
                  href={b.url}
                  variant={b.retailer === "bookshop" ? "secondary" : "ghost"}
                  rel={b.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                  target="_blank"
                >
                  {b.retailer === "library" ? b.label : `Buy at ${b.label}`}
                </Button>
              ))}
            </div>
          </div>

          {/* Detail column. */}
          <div>
            <Eyebrow className="mb-3">
              {community ? "Tracked title" : "In the reading library"}
            </Eyebrow>
            <h1 className="fx-book-detail-title">{book.title}</h1>
            <p className="mt-3 fx-book-detail-text">
              by{" "}
              {book.authorSlug ? (
                <Link to={`/authors/${book.authorSlug}`} className="link">
                  {book.author}
                </Link>
              ) : (
                book.author
              )}
            </p>

            <div className="mt-5 fx-book-detail-row">
              {book.publicationYear ? <Chip>{book.publicationYear}</Chip> : null}
              {time ? <Chip>{time}</Chip> : null}
              {book.publisher ? <Chip>{book.publisher}</Chip> : null}
            </div>

            {awards.length > 0 ? (
              <div className="mt-6 fx-book-detail-card">
                <Eyebrow className="fx-book-detail-eyebrow">Recognition</Eyebrow>
                <ul className="fx-book-detail-stack-2">
                  {awards.map((a) => (
                    <li key={`${a.awardSlug}-${a.year}`} className="sans small">
                      <Link to={`/awards/${a.awardSlug}`} className="link">
                        {a.awardName}
                      </Link>
                      <span className="dim">
                        {a.year ? `, ${a.year}` : ""} · {a.distinction}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {book.description ? (
              <div className="mt-8 fx-book-detail-box-3">
                {book.description
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((para) => (
                    <p key={para.slice(0, 40)}>{para}</p>
                  ))}
              </div>
            ) : null}

            {book.subjects.length > 0 ? (
              <div className="mt-8">
                <Eyebrow className="mb-3">Subjects</Eyebrow>
                <div className="row-2 wrap">
                  {book.subjects.slice(0, 12).map((s) => (
                    <TagPill key={s} to={`/books?subject=${encodeURIComponent(s)}`}>
                      {s}
                    </TagPill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <section className="fx-book-detail-section">
            <h2 className="mb-6 fx-book-detail-title-2">More like this</h2>
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
