// Describes only what ships in this build today; do not describe the reader, AI companion or clubs as if they exist beyond it (deferred_items).
import { PageShell } from "~/components/page-shell";
import { FeatureList, GuideFooter, GuideNav, Prose, Section } from "~/components/guide-page";
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
      <Container className="measure-prose cap-stack" data-gap="8">
        <PageHeader title="What Foxing does" />

        <GuideNav anchors={NAV_ANCHORS} />

        <Section id="read" heading="1,400+ classic books, free to read">
          <Prose>
            Every book in the catalog is from the public domain: Frankenstein, Pride and Prejudice,
            Sherlock Holmes, Moby-Dick, Dracula, Crime and Punishment, and 1,400 more. Free to read
            in full. No subscription, no account required to open a book.
          </Prose>
        </Section>

        <Section id="find" heading="Find what to read next">
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

        <Section id="track" heading="Keep track of what you read">
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

        <Section id="journal" heading="Essays on the books in the library">
          <Prose>
            Close readings, context, and short essays on the classics and the ideas inside them,
            browsable by tag.
          </Prose>
        </Section>

        <Section id="account" heading="Your data is yours">
          <FeatureList
            items={[
              "Edit your profile and manage your passkeys from Settings",
              "Download every row of your account data as JSON, on demand",
              "Delete your account and everything tied to it, permanently",
            ]}
          />
        </Section>

        <GuideFooter />
      </Container>
    </PageShell>
  );
}
