// Trimmed rewrite of legacy /features (1,043 lines describing a much larger, mostly
// unbuilt product: reader, AI companion, clubs, social, vocabulary, stats charts).
// This page describes only what ships in this build today. It grows as slices land;
// do not describe the reader, AI companion, or clubs as if they exist (deferred_items).
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { FeatureList, GuideNav, Prose, Section } from "~/components/guide-page";
import { Container, PageHeader } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/features";

export const headers = staticPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return buildMeta({
    title: "What Foxing does",
    description: "Everything on this page is available today, free.",
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
      <Container className="measure-prose">
        <PageHeader
          title="What Foxing does"
          lede="Everything on this page is available today, free. This page grows as more of Foxing ships."
        />

        <GuideNav anchors={NAV_ANCHORS} />

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
              "Edit your profile and manage your passkeys from Settings",
              "Download every row of your account data as JSON, on demand",
              "Delete your account and everything tied to it, permanently",
            ]}
          />
        </Section>

        <p className="mt-16 fx-guide-text">
          Free to join.{" "}
          <Link to="/signup" className="link">
            Create an account
          </Link>{" "}
          or{" "}
          <Link to="/books" className="link">
            browse the library
          </Link>
          .
        </p>
      </Container>
    </PageShell>
  );
}
