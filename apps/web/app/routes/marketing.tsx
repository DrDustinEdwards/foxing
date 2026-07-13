import { catalogRepo } from "@foxing/core";
import { Link, redirect } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { Button, Container, Eyebrow } from "~/components/ui";
import { getAuth } from "~/lib/auth.server";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/marketing";

// FAQ structured data (schema.org FAQPage). Restores the rich result the legacy
// landing emitted. Availability is phrased for web-now, apps-coming-soon since the
// mobile app is not shipping yet. Plus pricing stays in sync with billing/config.
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Where can I read classic books for free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Foxing offers 1,400+ public domain classic books completely free, including Frankenstein, Pride and Prejudice, Sherlock Holmes, and Dracula. No subscription is required to read. Foxing is available on the web at foxing.app, with iOS and Android apps coming soon.",
      },
    },
    {
      "@type": "Question",
      name: "What classic books are available to read online free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Foxing includes all major public domain works: Jane Austen (Pride and Prejudice, Sense and Sensibility, Emma), Charles Dickens, Mary Shelley (Frankenstein), Bram Stoker (Dracula), Arthur Conan Doyle (Sherlock Holmes), Mark Twain, Charlotte Bronte (Jane Eyre), and 1,400+ more titles from Standard Ebooks and Project Gutenberg.",
      },
    },
    {
      "@type": "Question",
      name: "What is Foxing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Foxing is a reading home for classic literature. It offers 1,400+ free public domain books, an AI companion that helps you understand what you are reading, book clubs with chapter-by-chapter discussions, and a reading community. Available on the web, with mobile apps coming soon.",
      },
    },
    {
      "@type": "Question",
      name: "Is Foxing free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The complete reading and social product is free: the reader, all 1,400+ classic books, tracking and stats, and the entire clubs layer (unlimited clubs, discussions, and shared annotations). Foxing Plus ($12.99/month) adds the AI reading companion. A 7-day free trial is available.",
      },
    },
    {
      "@type": "Question",
      name: "Does Foxing have an AI for reading?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Foxing includes an AI companion. Tap any word for a contextual definition. Tap any passage for analysis, historical context, or a plain English explanation. Ask the AI anything about the book without spoilers. The AI companion is a Foxing Plus feature.",
      },
    },
  ],
};

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
  return [
    ...buildMeta({
      title: "Foxing",
      description:
        "Foxing is a reading home for the classics: read free, track what you finish, and follow the conversations around great books.",
      origin: data?.origin ?? "",
      pathname: location.pathname,
    }),
    ldJson(FAQ_SCHEMA),
  ];
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

      {/* App / get-started. The mobile apps are not shipping yet, so the CTA joins on
          web rather than linking dead store pages. Swap in store badges when mobile
          ships. */}
      <Container className="mt-16">
        <section className="rounded-hero border border-border-subtle bg-surface p-8 text-center shadow-card-sm sm:p-12">
          <Eyebrow className="mb-3">Start reading</Eyebrow>
          <h2 className="mx-auto max-w-2xl font-display text-3xl leading-tight sm:text-4xl">
            Read the classics. Finally understand them.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-secondary">
            Read free on the web today. The iOS and Android apps are on the way, with your library,
            highlights, and streak carried across.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button to="/signup">Join free on web</Button>
            <Button to="/books" variant="secondary">
              Browse the library
            </Button>
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.08em] text-tertiary">
            iOS and Android apps coming soon
          </p>
        </section>
      </Container>
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
