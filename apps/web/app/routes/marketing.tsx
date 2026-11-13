import { formatCount } from "@drdustinedwards/site-helpers/text";
import { faqPage } from "@drdustinedwards/site-helpers/schema";
import { catalogRepo } from "@foxing/core";
import { redirect } from "react-router";
import { CtaBand } from "capsomer/react/cta-band";
import { Hero } from "capsomer/react/hero";
import { Link } from "capsomer/react/link";
import "capsomer/hero.css";
import "capsomer/cta-band.css";
import { BookCard, BookGrid } from "~/components/book-card";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { Button, Container, EntityCard, Eyebrow } from "~/components/ui";
import { sessionUserFromRequest } from "~/lib/auth.server";
import { listingPageHeaders, loaderBase } from "~/lib/loader.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { buildMeta, organizationLd, websiteLd } from "~/lib/seo";
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
  const user = await sessionUserFromRequest(request, env);
  if (user) throw redirect("/home");
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
    jsonLd(websiteLd()),
    jsonLd(organizationLd()),
    jsonLd(FAQ_SCHEMA),
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { pick, books, total, posts } = loaderData;

  return (
    <PageShell>
      {/* Hero */}
      <Container className="py-6">
        <Hero
          align="center"
          eyebrow="A reading home for the classics"
          title="Read the classics. Keep the record."
          lead={`${formatCount(total)} books, free to read. Track what you finish, mark the passages that stay with you, and follow the picks worth reading.`}
          actions={
            <>
              <div className="fx-hero-search">
                <SearchBox />
              </div>
              <Button to="/books">Browse the library</Button>
              <Button to="/awards" variant="secondary">
                Award winners
              </Button>
            </>
          }
        />
      </Container>

      <ValueProps />

      {/* Today's Pick: a published Book of the Month, or a staff pick. */}
      {pick ? (
        <Container className="mt-16">
          <article className="cap-card fx-pick">
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
              <h2 className="cap-title mt-2" data-size="3">
                <Link to={`/books/${pick.book.slug}`} className="hover-accent">
                  {pick.book.title}
                </Link>
              </h2>
              <p className="cap-text mt-1" data-tone="muted" data-face="ui">
                {pick.book.author}
              </p>
              {pick.note ? (
                <p className="cap-text cap-clamp mt-3" data-tone="muted">
                  {pick.note}
                </p>
              ) : null}
              {pick.source === "botm" ? (
                <Link
                  to="/book-of-the-month"
                  className="cap-text link mt-3 block"
                  data-size="small"
                  data-face="ui"
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
        <div className="cap-spread mb-6" data-gap="4" data-align="end">
          <h2 className="cap-title" data-size="3">
            From the shelves
          </h2>
          <Link to="/books" className="cap-text link" data-size="small" data-face="ui">
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
          <div className="cap-spread mb-6" data-gap="4" data-align="end">
            <h2 className="cap-title" data-size="3">
              From the Journal
            </h2>
            <Link to="/journal" className="cap-text link" data-size="small" data-face="ui">
              All essays
            </Link>
          </div>
          <div className="cap-grid" data-cols="3" data-gap="5">
            {posts.map((p) => (
              <EntityCard key={p.slug} to={`/journal/${p.slug}`}>
                <h3 className="cap-title" data-size="5">
                  {p.title}
                </h3>
                {p.excerpt ? (
                  <p className="cap-text cap-clamp" data-tone="muted" data-lines="3">
                    {p.excerpt}
                  </p>
                ) : null}
              </EntityCard>
            ))}
          </div>
        </Container>
      ) : null}

      {/* App / get-started. The mobile apps are not shipping yet, so the CTA joins on
          web rather than linking dead store pages. Swap in store badges when mobile
          ships. */}
      <Container className="mt-16">
        <CtaBand
          eyebrow="Start reading"
          title="Read the classics. Finally understand them."
          note="iOS and Android apps coming soon"
          actions={
            <>
              <Button to="/signup">Join free on web</Button>
              <Button to="/books" variant="secondary">
                Browse the library
              </Button>
            </>
          }
        >
          Read free on the web today. The iOS and Android apps are on the way, with your library,
          highlights, and streak carried across.
        </CtaBand>
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
    <div className="cap-stack" data-gap="4">
      <span className="fx-mark">{icon}</span>
      <h2 className="cap-title" data-size="5">
        {heading}
      </h2>
      <p className="cap-text" data-tone="muted">
        {children}
      </p>
    </div>
  );
}
