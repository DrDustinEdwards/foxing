import { faqPage } from "@drdustinedwards/site-helpers/schema";
import { catalogRepo } from "@foxing/core";
import { redirect } from "react-router";
import { Link } from "capsomer/react/link";
import { BookCard, BookGrid } from "~/components/book-card";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { Button, Container, Eyebrow } from "~/components/ui";
import { getAuth } from "~/lib/auth.server";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { buildMeta, ldJson } from "~/lib/seo";
import type { Route } from "./+types/marketing";

// FAQ structured data (schema.org FAQPage). Restores the rich result the legacy
// landing emitted. Availability is phrased for web-now, apps-coming-soon since the
// mobile app is not shipping yet. Plus pricing stays in sync with billing/config.
const FAQ_SCHEMA = faqPage([
  {
    question: "Where can I read classic books for free?",
    answer:
      "Foxing offers 1,400+ public domain classic books completely free, including Frankenstein, Pride and Prejudice, Sherlock Holmes, and Dracula. No subscription is required to read. Foxing is available on the web at foxing.app, with iOS and Android apps coming soon.",
  },
  {
    question: "What classic books are available to read online free?",
    answer:
      "Foxing includes all major public domain works: Jane Austen (Pride and Prejudice, Sense and Sensibility, Emma), Charles Dickens, Mary Shelley (Frankenstein), Bram Stoker (Dracula), Arthur Conan Doyle (Sherlock Holmes), Mark Twain, Charlotte Bronte (Jane Eyre), and 1,400+ more titles from Standard Ebooks and Project Gutenberg.",
  },
  {
    question: "What is Foxing?",
    answer:
      "Foxing is a reading home for classic literature. It offers 1,400+ free public domain books, an AI companion that helps you understand what you are reading, book clubs with chapter-by-chapter discussions, and a reading community. Available on the web, with mobile apps coming soon.",
  },
  {
    question: "Is Foxing free to use?",
    answer:
      "Yes. The complete reading and social product is free: the reader, all 1,400+ classic books, tracking and stats, and the entire clubs layer (unlimited clubs, discussions, and shared annotations). Foxing Plus ($12.99/month) adds the AI reading companion. A 7-day free trial is available.",
  },
  {
    question: "Does Foxing have an AI for reading?",
    answer:
      "Yes. Foxing includes an AI companion. Tap any word for a contextual definition. Tap any passage for analysis, historical context, or a plain English explanation. Ask the AI anything about the book without spoilers. The AI companion is a Foxing Plus feature.",
  },
]);

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, env } = loaderBase(context, request);
  // Signed-in visitors get their dashboard; "/" stays the marketing page for
  // anonymous visitors (whose response is the one that gets edge-cached).
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  if (session?.user) throw redirect("/home");
  const [pick, browse, journal] = await Promise.all([
    catalogRepo.getTodaysPick(db),
    catalogRepo.listBooks(db, { sort: "title", pageSize: 10 }),
    catalogRepo.listPublishedPosts(db, { pageSize: 3 }),
  ]);
  return { pick, books: browse.books, total: browse.total, posts: journal.posts };
}

export const headers = listingPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return [
    ...buildMeta({
      title: "Foxing",
      description:
        "Foxing is a reading home for the classics: read free, track what you finish, and follow the conversations around great books.",
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
      <Container className="py-6">
        <div className="fx-hero">
          <Eyebrow className="mb-4">A reading home for the classics</Eyebrow>
          <h1 className="fx-hero-title">Read the classics. Keep the record.</h1>
          <p className="lead measure-xl center mt-5">
            {total.toLocaleString()} books, free to read. Track what you finish, mark the passages
            that stay with you, and follow the picks worth reading.
          </p>
          <div className="measure-xl center mt-8">
            <SearchBox />
          </div>
          <div className="row wrap justify-center mt-5">
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
          <article className="card card-hero fx-pick">
            <div className="fx-pick-cover">
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
              <h2 className="display-2 mt-2">
                <Link to={`/books/${pick.book.slug}`} className="hover-accent">
                  {pick.book.title}
                </Link>
              </h2>
              <p className="mt-1 sans muted">{pick.book.author}</p>
              {pick.note ? <p className="mt-3 clamp-2 muted">{pick.note}</p> : null}
              {pick.source === "botm" ? (
                <Link to="/book-of-the-month" className="link sans small mt-3 block">
                  Why this book
                </Link>
              ) : null}
            </div>
          </article>
        </Container>
      ) : null}

      {/* From the shelves */}
      <Container className="mt-16">
        <div className="row spread items-end mb-6">
          <h2 className="display-2">From the shelves</h2>
          <Link to="/books" className="link sans small">
            See all
          </Link>
        </div>
        <BookGrid>
          {/* Below the fold at every width, so none of these covers is fetched first. */}
          {books.slice(0, 10).map((b) => (
            <BookCard key={b.slug} book={b} />
          ))}
        </BookGrid>
      </Container>

      {/* From the Journal */}
      {posts.length > 0 ? (
        <Container className="mt-16">
          <div className="row spread items-end mb-6">
            <h2 className="display-2">From the Journal</h2>
            <Link to="/journal" className="link sans small">
              All essays
            </Link>
          </div>
          <div className="grid-3">
            {posts.map((p) => (
              <Link key={p.slug} to={`/journal/${p.slug}`} className="fx-entity">
                <h3 className="display-0 fx-entity-title">{p.title}</h3>
                {p.excerpt ? <p className="mt-2 clamp-3 muted">{p.excerpt}</p> : null}
              </Link>
            ))}
          </div>
        </Container>
      ) : null}

      {/* App / get-started. The mobile apps are not shipping yet, so the CTA joins on
          web rather than linking dead store pages. Swap in store badges when mobile
          ships. */}
      <Container className="mt-16">
        <section className="card card-hero fx-cta">
          <Eyebrow className="mb-3">Start reading</Eyebrow>
          <h2 className="fx-cta-title">Read the classics. Finally understand them.</h2>
          <p className="measure-xl center mt-4 muted">
            Read free on the web today. The iOS and Android apps are on the way, with your library,
            highlights, and streak carried across.
          </p>
          <div className="row wrap justify-center mt-6">
            <Button to="/signup">Join free on web</Button>
            <Button to="/books" variant="secondary">
              Browse the library
            </Button>
          </div>
          <p className="mt-4 card-label">iOS and Android apps coming soon</p>
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
      <div className="fx-values">
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
    <div className="stack-3">
      <span className="accent-ui">{icon}</span>
      <h2 className="display-0">{heading}</h2>
      <p className="muted">{children}</p>
    </div>
  );
}
