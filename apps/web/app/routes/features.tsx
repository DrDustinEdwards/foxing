// Trimmed rewrite of legacy /features (1,043 lines describing a much larger, mostly
// unbuilt product: reader, AI companion, clubs, social, vocabulary, stats charts).
// This page describes only what ships in this build today. It grows as slices land;
// do not describe the reader, AI companion, or clubs as if they exist (deferred_items).
import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/features";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { origin } = loaderBase(context, request);
  return { origin };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(3600, 604800);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return buildMeta({
    title: "What Foxing does",
    description: "Everything on this page is available today, free.",
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

const NAV_ANCHORS = [
  { href: "#read", label: "Read" },
  { href: "#find", label: "Browse & search" },
  { href: "#track", label: "Track" },
  { href: "#journal", label: "Journal" },
  { href: "#account", label: "Account" },
];

export default function Features() {
  return (
    <PageShell>
      <Container className="max-w-prose">
        <PageHeader
          title="What Foxing does"
          lede="Everything on this page is available today, free. This page grows as more of Foxing ships."
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

        <Section id="read" eyebrow="Read" heading="1,400+ classic books, free to read">
          <Prose>
            Every book in the catalog is from the public domain: Frankenstein, Pride and Prejudice,
            Sherlock Holmes, Moby-Dick, Dracula, Crime and Punishment, and 1,400 more. Free to read
            in full. No subscription, no account required to open a book.
          </Prose>
        </Section>

        <Section id="find" eyebrow="Browse & search" heading="Find what to read next">
          <FeatureList
            items={[
              "Browse by genre, era, or book length",
              "Literary award winners, organized by award",
              "Celebrity picks, organized by club",
              "Foxing's own monthly pick",
              "Search that groups results by book and author",
              "Search that forgives a misspelled author (typo-tolerant fuzzy match)",
              "A command palette (Ctrl+K / Cmd+K) for jumping anywhere fast",
            ]}
          />
        </Section>

        <Section id="track" eyebrow="Track" heading="Keep track of what you read">
          <Prose>
            Every book you've read, every book you want to read. On the web, no app required.
          </Prose>
          <FeatureList
            items={[
              "Shelf status per book: Want to Read, Reading, Finished, Paused, Abandoned",
              "Custom shelves beyond the presets, create and delete your own",
              "Reading goals: a target number of books per month or week",
              "Reading streaks that track consecutive days finished",
            ]}
          />
        </Section>

        <Section id="journal" eyebrow="Journal" heading="Essays on the books in the library">
          <Prose>
            Close readings, context, and short essays on the classics and the ideas inside them,
            browsable by tag.
          </Prose>
        </Section>

        <Section id="account" eyebrow="Account" heading="Your data is yours">
          <FeatureList
            items={[
              "Edit your profile and change your password from Settings",
              "Download every row of your account data as JSON, on demand",
              "Delete your account and everything tied to it, permanently",
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
