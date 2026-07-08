import { catalogRepo } from "@foxing/core";
import { Link } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { Button, Container, Eyebrow } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/home";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const [botm, browse, journal] = await Promise.all([
    catalogRepo.getCurrentBotm(db),
    catalogRepo.listBooks(db, { sort: "title", pageSize: 10 }),
    catalogRepo.listPublishedPosts(db, { pageSize: 3 }),
  ]);
  return { origin, botm, books: browse.books, total: browse.total, posts: journal.posts };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(600, 86400);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return buildMeta({
    title: "Foxing",
    description:
      "Foxing is a reading home for the classics: read free, track what you finish, and follow the conversations around great books.",
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { botm, books, total, posts } = loaderData;

  return (
    <PageShell>
      {/* Hero */}
      <Container className="pb-6 pt-6">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow className="mb-4">Letterboxd for books</Eyebrow>
          <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">
            Read the classics. Keep the record.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-secondary">
            {total.toLocaleString()} books, free to read. Track what you finish, mark the passages
            that stay with you, and follow the picks worth reading.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <SearchBox />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button to="/books">Browse the library</Button>
            <Button to="/awards" variant="secondary">
              Award winners
            </Button>
          </div>
        </div>
      </Container>

      {/* This month */}
      {botm?.book ? (
        <Container className="mt-16">
          <article className="grid gap-6 rounded-hero border border-border-subtle bg-surface p-6 shadow-card-sm sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)] sm:items-center sm:p-8">
            <div className="mx-auto w-full max-w-[160px]">
              <Link to={`/books/${botm.book.slug}`}>
                <CoverImage
                  src={botm.book.coverUrl}
                  alt={`${botm.book.title} by ${botm.book.author}`}
                  fallbackLabel={botm.book.title}
                  sizes="160px"
                />
              </Link>
            </div>
            <div>
              <Eyebrow>Book of the Month</Eyebrow>
              <h2 className="mt-2 font-display text-2xl leading-tight">
                <Link to={`/books/${botm.book.slug}`} className="hover:text-brand-text">
                  {botm.book.title}
                </Link>
              </h2>
              <p className="mt-1 font-ui text-secondary">{botm.book.author}</p>
              {botm.curatorNote ? (
                <p className="mt-3 line-clamp-2 font-body text-secondary">{botm.curatorNote}</p>
              ) : null}
              <Link
                to="/book-of-the-month"
                className="mt-3 inline-block font-ui text-sm text-brand-text hover:underline"
              >
                Why this book
              </Link>
            </div>
          </article>
        </Container>
      ) : null}

      {/* From the shelves */}
      <Container className="mt-16">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-2xl">From the shelves</h2>
          <Link to="/books" className="font-ui text-sm text-brand-text hover:underline">
            See all
          </Link>
        </div>
        <BookGrid>
          {books.slice(0, 10).map((b, i) => (
            <BookCard key={b.slug} book={b} priority={i < 6} />
          ))}
        </BookGrid>
      </Container>

      {/* From the Journal */}
      {posts.length > 0 ? (
        <Container className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-2xl">From the Journal</h2>
            <Link to="/journal" className="font-ui text-sm text-brand-text hover:underline">
              All essays
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.slug}
                to={`/journal/${p.slug}`}
                className="group rounded-card border border-border-subtle bg-surface p-5 shadow-card-sm transition-shadow hover:shadow-card-md"
              >
                <h3 className="font-display text-lg leading-snug text-primary group-hover:text-brand-text">
                  {p.title}
                </h3>
                {p.excerpt ? (
                  <p className="mt-2 line-clamp-3 font-body text-secondary">{p.excerpt}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </Container>
      ) : null}
    </PageShell>
  );
}
