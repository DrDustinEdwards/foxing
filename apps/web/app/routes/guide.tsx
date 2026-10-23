import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow, PageHeader } from "~/components/ui";
import { loaderBase, staticPageHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/guide";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { origin } = loaderBase(context, request);
  return { origin };
}

export const headers = staticPageHeaders;

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return buildMeta({
    title: "Using Foxing on the web",
    description:
      "How to find books, track your reading, join clubs, and follow other readers on foxing.app.",
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

const NAV_ANCHORS = [
  { href: "#find", label: "Find books" },
  { href: "#read", label: "Read" },
  { href: "#track", label: "Track" },
  { href: "#clubs", label: "Clubs" },
  { href: "#follow", label: "Follow" },
  { href: "#account", label: "Account" },
];

export default function Guide() {
  return (
    <PageShell>
      <Container className="max-w-prose">
        <PageHeader
          title="Using Foxing on the web"
          lede="How the foxing.app web platform works: finding books, tracking your reading, joining clubs, and following other readers."
        />

        <nav
          aria-label="Sections"
          className="mb-12 flex flex-wrap gap-4 border-b border-border-subtle pb-6 font-ui text-sm text-brand-text"
        >
          {NAV_ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="hover:underline">
              {a.label}
            </a>
          ))}
        </nav>

        <Section id="find" eyebrow="Find books" heading="Finding what to read next">
          <Prose>
            The catalog is public-domain literature, free to read and free to browse. No account is
            needed to open a book. Browse by genre, era, or book length, or use search, which groups
            results by book and author and forgives a misspelled author name.
          </Prose>
          <FeatureList
            items={[
              "Literary award winners, organized by award",
              "Celebrity picks, organized by club",
              "Foxing's own Book of the Month",
              "A command palette (Ctrl+K or Cmd+K) for jumping anywhere fast",
            ]}
          />
        </Section>

        <Section id="read" eyebrow="Read" heading="Reading in the browser">
          <Prose>
            Open any book to read it in the web reader. Your place is saved as you go, so you return
            to where you left off. The reader shares your account, so a book you start on the web
            picks up on the mobile app, and the reverse.
          </Prose>
        </Section>

        <Section id="track" eyebrow="Track" heading="Keeping track of your reading">
          <Prose>
            Every book has a shelf selector. Set its status, and it appears in your library.
          </Prose>
          <FeatureList
            items={[
              "Shelf status per book: Want to Read, Reading, Finished, Paused, Set Aside",
              "A reading diary, a dated log of what you finished, with private or public entries",
              "Reading goals: an annual target that fills in as you finish books",
              "Reading stats: books finished, pages read, average rating, and current streak",
            ]}
          />
        </Section>

        <Section id="clubs" eyebrow="Clubs" heading="Joining a book club">
          <Prose>
            foxing.app/clubs lists public reading clubs. Join any of them from the web. Clubs are
            separate from the celebrity picks at foxing.app/book-clubs and from Foxing's own monthly
            pick. Creating a club is a Plus feature, and a club can be public, private, or secret.
          </Prose>
        </Section>

        <Section id="follow" eyebrow="Follow" heading="Following other readers">
          <Prose>
            Follow any reader from a public profile, and their activity appears in your home feed. A
            public profile shows favorite books, recent reviews, and reading stats. You control what
            others see from Settings.
          </Prose>
        </Section>

        <Section id="account" eyebrow="Account" heading="Your account and settings">
          <FeatureList
            items={[
              "Edit your profile, change your email or username, and set light or dark mode",
              "Toggle whether your reading profile and progress are visible to others",
              "See your plan and upgrade to Plus",
              "Download your account data as JSON, or delete your account permanently",
            ]}
          />
        </Section>

        <p className="mt-16 font-ui text-sm text-secondary">
          Free to join.{" "}
          <Link to="/signup" className="text-brand-text hover:underline">
            Create an account
          </Link>{" "}
          or{" "}
          <Link to="/books" className="text-brand-text hover:underline">
            browse the library
          </Link>
          .
        </p>
      </Container>
    </PageShell>
  );
}

function Section({
  id,
  eyebrow,
  heading,
  children,
}: {
  id: string;
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-24">
      <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
      <h2 className="font-display text-2xl leading-tight text-primary">{heading}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-base text-secondary">{children}</p>;
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 font-body text-base text-secondary">
          <span aria-hidden="true" className="text-brand-ui">
            &middot;
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
