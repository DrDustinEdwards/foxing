import { Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container, Eyebrow, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/app-guide";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { origin } = loaderBase(context, request);
  return { origin };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(3600, 604800);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return buildMeta({
    title: "Using the Foxing app",
    description:
      "How the Foxing mobile app works: reading offline, highlights and notes, vocabulary, sync, and notifications.",
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

const NAV_ANCHORS = [
  { href: "#reading", label: "Reading" },
  { href: "#highlights", label: "Highlights" },
  { href: "#vocabulary", label: "Vocabulary" },
  { href: "#companion", label: "Companion" },
  { href: "#sync", label: "Sync" },
  { href: "#notifications", label: "Notifications" },
];

export default function AppGuide() {
  return (
    <PageShell>
      <Container className="max-w-prose">
        <PageHeader
          title="Using the Foxing app"
          lede="How the Foxing mobile app works: reading offline, highlights and notes, vocabulary, sync across devices, and notifications."
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

        <Section id="reading" eyebrow="Reading" heading="Reading offline">
          <Prose>
            Open a book from your library and it downloads to your device in a few seconds. Once it
            is on your device, it reads offline, with no connection needed. Your place is saved
            every time you leave the reader, so you return to exactly where you left off.
          </Prose>
          <FeatureList
            items={[
              "Reading themes: warm white, sepia, dark, and true black",
              "Adjustable font size",
              "A chapter list for jumping between chapters",
              "Turn pages by swiping or tapping the screen edges",
            ]}
          />
        </Section>

        <Section id="highlights" eyebrow="Highlights" heading="Highlights and notes">
          <Prose>
            Tap and drag to select a passage, then pick a color. There are seven colors to sort your
            highlights however you like. Add a note to any highlight. If your profile is public,
            highlights you mark public appear on your profile and on the book's page on the web,
            where other readers can like them.
          </Prose>
        </Section>

        <Section id="vocabulary" eyebrow="Vocabulary" heading="Vocabulary lookups">
          <Prose>
            Tap any word to see what it means in that sentence, in that book. Every word you look up
            is saved to your vocabulary with its definition, the sentence you found it in, and the
            book it came from. See the full list at foxing.app/vocabulary, and export it for
            spreadsheets or flashcards.
          </Prose>
        </Section>

        <Section id="companion" eyebrow="Companion" heading="The AI reading companion">
          <Prose>
            Foxing Plus adds an AI companion to the reader. Select a passage for a plainer reading,
            historical context, or the literary devices at work. Ask your own question, or get a
            chapter or book summary. The companion defaults to spoiler-free and can be switched to
            discuss the ending.
          </Prose>
        </Section>

        <Section id="sync" eyebrow="Sync" heading="Sync across devices">
          <Prose>
            Your account is the same everywhere. Reading position, shelves, highlights, and
            vocabulary sync between your phone and foxing.app. Changes you make offline are queued
            and sync the next time you have a connection, so a book you start on the web continues
            on the app, and the reverse.
          </Prose>
        </Section>

        <Section id="notifications" eyebrow="Notifications" heading="Notifications">
          <Prose>
            Push notifications keep you current on the reading you care about: replies in your
            clubs, new followers, and reminders tied to your reading goals. Turn them on or off from
            the app settings.
          </Prose>
        </Section>

        <p className="mt-16 font-ui text-sm text-secondary">
          New to Foxing?{" "}
          <Link to="/guide" className="text-brand-text hover:underline">
            Read the web guide
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
