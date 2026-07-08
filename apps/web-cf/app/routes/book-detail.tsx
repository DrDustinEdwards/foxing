import { catalogRepo } from "@foxing/core";
import { buyLinks } from "@foxing/core";
import { Link } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Breadcrumbs, Button, Chip, Container, Eyebrow, TagPill } from "~/components/ui";
import { affiliateConfig, loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { bookLd, breadcrumbLd, buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/book-detail";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env, origin } = loaderBase(context, request);
  const book = await catalogRepo.getBookBySlug(db, params.slug);
  if (!book) throw new Response("Not found", { status: 404 });

  const [awards, related] = await Promise.all([
    catalogRepo.getBookAwards(db, book.id),
    catalogRepo.getRelatedBooks(db, book, 6),
  ]);

  const readable = catalogRepo.isReadable(book);
  const community = book.sourceType === "community";

  return {
    origin,
    community,
    readable,
    awards,
    related,
    buys: buyLinks(book, affiliateConfig(env)),
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
      subjects: book.subjects ?? [],
      isbn13: book.isbn13,
      publisher: book.publisher,
    },
  };
}

export function headers(): HeadersInit {
  return publicCacheHeaders();
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Book not found | Foxing" }];
  const { book, origin, community } = data;
  const description =
    book.description?.slice(0, 200) ??
    `${book.title} by ${book.author} on Foxing. Read the classics and track your reading.`;
  return [
    ...buildMeta({
      title: `${book.title} by ${book.author}`,
      description,
      origin,
      pathname: location.pathname,
      image: `/og/book/${book.slug}`,
      imageAlt: `${book.title} by ${book.author}`,
      type: "book",
      noindex: community,
    }),
    ldJson(bookLd(origin, book)),
    ldJson(
      breadcrumbLd(origin, [
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

        <div className="grid gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* Cover column (LCP). */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="mx-auto max-w-[260px] lg:mx-0">
              <CoverImage
                src={book.coverUrl}
                alt={`Cover of ${book.title} by ${book.author}`}
                fallbackLabel={book.title}
                priority
                sizes="(min-width: 1024px) 260px, 60vw"
              />
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              {readable ? (
                <Button to={`/read/${book.slug}`} variant="primary">
                  Read now
                </Button>
              ) : null}
              {buys.map((b) => (
                <Button
                  key={b.retailer}
                  href={b.url}
                  variant={b.retailer === "bookshop" ? "secondary" : "ghost"}
                  rel="sponsored noopener noreferrer"
                  target="_blank"
                >
                  Buy at {b.label}
                </Button>
              ))}
              {!readable && buys.length === 0 ? (
                <p className="rounded-cover border border-border-subtle px-4 py-2.5 text-center font-ui text-sm text-tertiary">
                  Tracking only for now
                </p>
              ) : null}
            </div>
          </div>

          {/* Detail column. */}
          <div>
            <Eyebrow className="mb-3">
              {community ? "Tracked title" : "In the reading library"}
            </Eyebrow>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">{book.title}</h1>
            <p className="mt-3 font-ui text-lg text-secondary">
              by{" "}
              {book.authorSlug ? (
                <Link
                  to={`/authors/${book.authorSlug}`}
                  className="text-brand-text hover:underline"
                >
                  {book.author}
                </Link>
              ) : (
                book.author
              )}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {book.publicationYear ? <Chip>{book.publicationYear}</Chip> : null}
              {time ? <Chip>{time}</Chip> : null}
              {book.language ? <Chip>{book.language.toUpperCase()}</Chip> : null}
              {book.publisher ? <Chip>{book.publisher}</Chip> : null}
            </div>

            {awards.length > 0 ? (
              <div className="mt-6 rounded-card border border-border-subtle bg-surface p-4">
                <Eyebrow className="mb-2.5">Recognition</Eyebrow>
                <ul className="flex flex-col gap-1.5">
                  {awards.map((a) => (
                    <li key={`${a.awardSlug}-${a.year}`} className="font-ui text-sm">
                      <Link
                        to={`/awards/${a.awardSlug}`}
                        className="text-brand-text hover:underline"
                      >
                        {a.awardName}
                      </Link>
                      <span className="text-tertiary">
                        {a.year ? ` — ${a.year}` : ""} · {a.distinction}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {book.description ? (
              <div className="mt-8 max-w-prose font-body text-lg leading-relaxed text-secondary [&>p]:mt-4">
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
                <div className="flex flex-wrap gap-2">
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
          <section className="mt-20">
            <h2 className="mb-6 font-display text-2xl">More like this</h2>
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
