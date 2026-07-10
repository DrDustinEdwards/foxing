import { catalogRepo } from "@foxing/core";
import { Link, redirect } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { Button, Container, Eyebrow } from "~/components/ui";
import { getAuth } from "~/lib/auth.server";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/marketing";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, env, origin } = loaderBase(context, request);
  // Signed-in visitors get their dashboard; "/" stays the marketing page for
  // anonymous visitors (whose response is the one that gets edge-cached).
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (session?.user) throw redirect("/home");
  const [pick, browse, journal] = await Promise.all([
    catalogRepo.getTodaysPick(db),
    catalogRepo.listBooks(db, { sort: "title", pageSize: 10 }),
    catalogRepo.listPublishedPosts(db, { pageSize: 3 }),
  ]);
  return { origin, pick, books: browse.books, total: browse.total, posts: journal.posts };
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
  const { pick, books, total, posts } = loaderData;

  return (
    <PageShell>
      {/* Hero */}
      <Container className="pb-6 pt-6">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow className="mb-4">A reading home for the classics</Eyebrow>
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

      <ValueProps />

      {/* Today's Pick: a published Book of the Month, or a staff pick. */}
      {pick ? (
        <Container className="mt-16">
          <article className="grid gap-6 rounded-hero border border-border-subtle bg-surface p-6 shadow-card-sm sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)] sm:items-center sm:p-8">
            <div className="mx-auto w-full max-w-[160px]">
              <Link to={`/books/${pick.book.slug}`}>
                <CoverImage
                  src={pick.book.coverUrl}
                  alt={`${pick.book.title} by ${pick.book.author}`}
                  fallbackLabel={pick.book.title}
                  sizes="160px"
                />
              </Link>
            </div>
            <div>
              <Eyebrow>{pick.source === "botm" ? "Book of the Month" : "Today's Pick"}</Eyebrow>
              <h2 className="mt-2 font-display text-2xl leading-tight">
                <Link to={`/books/${pick.book.slug}`} className="hover:text-brand-text">
                  {pick.book.title}
                </Link>
              </h2>
              <p className="mt-1 font-ui text-secondary">{pick.book.author}</p>
              {pick.note ? (
                <p className="mt-3 line-clamp-2 font-body text-secondary">{pick.note}</p>
              ) : null}
              {pick.source === "botm" ? (
                <Link
                  to="/book-of-the-month"
                  className="mt-3 inline-block font-ui text-sm text-brand-text hover:underline"
                >
                  Why this book
                </Link>
              ) : null}
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

function BookOpenIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 6c-1.8-1.4-4-2-6.5-2v13c2.5 0 4.7.6 6.5 2m0-13c1.8-1.4 4-2 6.5-2v13c-2.5 0-4.7.6-6.5 2m0-13v13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShelfIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4v16M20 4v16M4 12h16M7 4v8M11 4v8M15 4v8M17 4v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m15 9-2 5-5 2 2-5 5-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ValueProps() {
  return (
    <Container className="mt-16">
      <div className="grid gap-10 sm:grid-cols-3">
        <ValueColumn icon={<BookOpenIcon />} heading="1,400+ classic books, free.">
          Public domain literature, properly formatted for reading on the web. No subscription, no
          paywall, no account required to open a book.
        </ValueColumn>
        <ValueColumn icon={<ShelfIcon />} heading="Track every book.">
          Mark what you're reading, finished, or paused. Set a reading goal, watch your streak
          build, and organize your own shelves.
        </ValueColumn>
        <ValueColumn icon={<CompassIcon />} heading="Find your next read.">
          Browse by genre, era, or length. Follow award winners and celebrity picks. Search that
          forgives a misspelled author.
        </ValueColumn>
      </div>
    </Container>
  );
}

function ValueColumn({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-brand-ui">{icon}</span>
      <h2 className="font-display text-lg text-primary">{heading}</h2>
      <p className="font-body text-base text-secondary">{children}</p>
    </div>
  );
}
