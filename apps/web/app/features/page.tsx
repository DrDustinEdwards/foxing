import Link from 'next/link'
import { type ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getNavUser } from '@/lib/nav-user'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const revalidate = 86_400

export const metadata = STATIC_PAGE_METADATA['/features']

const NAV_ANCHORS = [
  { href: '#read', label: 'Read' },
  { href: '#track', label: 'Track' },
  { href: '#understand', label: 'Understand' },
  { href: '#connect', label: 'Connect' },
  { href: '#organize', label: 'Organize' },
  { href: '#discover', label: 'Discover' },
]

export default async function FeaturesPage() {
  const navUser = await getNavUser()
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[900px] px-6 py-16">
          <header>
            <h1 className="font-fraunces text-[2.5rem] text-text-primary">
              What Foxing does
            </h1>
            <p className="mt-4 font-source-serif-4 text-base text-text-secondary leading-[1.85]">
              Everything on this page is available today. Free and Plus
              ($12.99/month) features are labeled.
            </p>
          </header>

          <nav
            aria-label="Sections"
            className="mt-10 mb-12 flex flex-wrap gap-4 border-b border-border-subtle pb-6 font-dm-sans text-sm text-brand-text"
          >
            {NAV_ANCHORS.map((a) => (
              <a key={a.href} href={a.href} className="hover:underline">
                {a.label}
              </a>
            ))}
          </nav>

          <Section
            id="read"
            eyebrow="Read"
            heading="1,400+ classic books, free to read"
            tier="free"
          >
            <Prose>
              Every book on Foxing is from the public domain. Frankenstein,
              Pride and Prejudice, Sherlock Holmes, Moby-Dick, Dracula, Crime
              and Punishment, and 1,400 more. Free to read. No subscription
              required.
            </Prose>
            <FeatureList
              items={[
                'Read on iOS, Android, and web',
                'Paginated reading with page-turn animations',
                'Continuous scroll mode',
                'Four reading themes: Default, Sepia, Dark, OLED Black',
                'Font size control',
                'Reading progress saved automatically across devices',
                'Chapter list and quick navigation',
                'Named bookmarks per book',
              ]}
            />
          </Section>

          <Section
            id="track"
            eyebrow="Track"
            heading="Keep track of what you read"
            tier="free"
          >
            <Prose>
              Every book you&apos;ve read, every book you want to read, every
              thought you had while reading it. Your reading life in one place.
            </Prose>
            <FeatureList
              items={[
                'Shelves: Reading, Want to Read, Finished, Paused, Set Aside',
                'Half-star ratings (10-point scale, so 3.5 stars is real)',
                'Written reviews, public or private',
                'Notes per book (private)',
                'Start and finish dates with backdating',
                'Mood and pacing tags per book',
                'Format tracking (ebook, physical, audio)',
                'Reading diary: dated entries, list view and calendar view',
                'Reading stats: books finished, pages read, average rating, streak',
                'Books per month chart (last 12 months)',
                'Genre breakdown chart',
                'Annual reading goal with progress bar',
                'Reading activity heatmap (last 52 weeks)',
                'Goodreads import (CSV, with preview before anything is saved)',
                'Export your full library as CSV',
              ]}
            />
          </Section>

          <Section
            id="understand"
            eyebrow="Understand"
            heading="An AI that reads with you"
          >
            <Prose>
              Tap any word you don&apos;t know. Foxing explains it in context,
              in the way the word is being used in that sentence in that book.
              That is the simplest version of what the AI companion does.
            </Prose>

            <Subgroup title="Word level" meta="Free: 5/day. Plus: unlimited">
              <FeatureList
                items={[
                  'Definition in context (not a generic dictionary definition)',
                  'Etymology and historical usage',
                  'Synonyms and antonyms',
                  'How the word appears in other literature',
                  'Word automatically saved to your vocabulary list',
                ]}
              />
            </Subgroup>

            <Subgroup title="Passage level" tier="plus">
              <FeatureList
                items={[
                  'Plain English version of a difficult passage',
                  'Historical context for what the passage is describing',
                  'Literary devices: metaphor, irony, foreshadowing, alliteration, and more',
                  'Mood and tone of the passage',
                  'Why the passage matters in the larger book',
                ]}
              />
            </Subgroup>

            <Subgroup title="Chapter level" tier="plus">
              <FeatureList
                items={[
                  "Summary before you start (catch up if you're returning)",
                  'Summary after you finish (consolidate what you read)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Whole book" tier="plus">
              <FeatureList
                items={[
                  'Full book summary',
                  'Character map with relationships',
                  'Theme and motif analysis',
                  'Author biography',
                  'Historical context for when the book was written',
                ]}
              />
            </Subgroup>

            <Subgroup title="AI Deep Dive" tier="plus">
              <FeatureList
                items={[
                  'Character arc analysis',
                  'Symbolism index',
                  'Literary criticism digest (what scholars have said)',
                  'Influence map (what influenced this book; what it influenced)',
                  'Narrative structure analysis',
                  'Point of view analysis',
                  'Setting analysis',
                  'First vs. second read guide (what to notice on a reread)',
                ]}
              />
            </Subgroup>

            <Subgroup title="AI companion chat" tier="plus">
              <FeatureList
                items={[
                  'Ask anything about the book',
                  "Spoiler-free mode: the AI won't reveal what comes later",
                  'Spoiler-full mode: ask about anything including the ending',
                ]}
              />
            </Subgroup>

            <Subgroup title="Vocabulary builder" tier="free">
              <FeatureList
                items={[
                  'Every word you look up is saved with its definition and the sentence you found it in',
                  'Filter by book or word',
                  'Mark words as mastered',
                  'Export as CSV or Anki flashcard deck',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="connect"
            eyebrow="Connect"
            heading="Read with other people"
          >
            <Prose>
              Public reading profiles. Inline passage comments tied to the exact
              line that prompted them. Book clubs with chapter-by-chapter
              discussions. The social layer is built around the books, not
              around engagement metrics.
            </Prose>

            <Subgroup title="Profiles" tier="free">
              <FeatureList
                items={[
                  'Public reading profile with your reading personality (one line, from your history)',
                  '5 favorite books on your profile',
                  'Follow other readers',
                  'See what friends are reading and finishing',
                  "Taste compatibility score when viewing another reader's profile",
                ]}
              />
            </Subgroup>

            <Subgroup
              title="Book clubs"
              meta="Free: join up to 1. Plus: create unlimited"
            >
              <FeatureList
                items={[
                  'Public, private, or secret clubs',
                  'Multiple admins and moderators',
                  'Chapter-gated discussion threads (spoiler protection by chapter)',
                  '11 thread types: general, chapter, prediction, first impressions, deep dive, hot take, quote, character, theme, questions, wrap-up',
                  'Inline passage comments tied to specific text positions (Plus)',
                  'Replies and emoji reactions on comments',
                  'Event announcements with date, location, and calendar file download',
                  'Member invites by username or email',
                  'Moderation: mute, ban, role changes, post removal',
                ]}
              />
            </Subgroup>

            <Subgroup title="Bookstore clubs" meta="verified by Foxing">
              <FeatureList
                items={[
                  'Fox badge on club page',
                  'Address, phone, website, hours displayed',
                  'Events appear on the geographic events feed at foxing.app/events',
                  '.ics calendar file for every event',
                ]}
              />
            </Subgroup>

            <Subgroup title="Highlights" tier="free">
              <FeatureList
                items={[
                  '7 colors: amber, auburn, yellow, sage, cobalt, crimson, purple',
                  'Notes on any highlight',
                  "Public highlights on your profile and the book's page",
                  'Other readers can like your highlights',
                ]}
              />
            </Subgroup>

            <Subgroup title="Buddy reads" tier="plus">
              <FeatureList
                items={[
                  'Read a book one-on-one with another reader',
                  'Chapter and page-anchored posts (spoiler protection built in)',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="organize"
            eyebrow="Organize"
            heading="Your reading life, organized"
          >
            <Prose>
              A vocabulary that grows every time you look up a word. Reading
              lists you can share. Goals that are actually about books.
            </Prose>

            <Subgroup tier="free">
              <FeatureList
                items={[
                  'Reading lists (public or private, shareable by link)',
                  'Community challenges (join a shared reading goal)',
                  'Annual reading goals with progress bar',
                  'Reading streak tracking (current and longest)',
                  'Reading activity heatmap (52 weeks)',
                  'Passage of the day on the home page (from community highlights, changes daily)',
                  "Vocabulary list: every word you've looked up, searchable, filterable by book",
                  'Vocabulary export as CSV or Anki flashcard deck',
                ]}
              />
            </Subgroup>

            <Subgroup tier="plus">
              <FeatureList
                items={[
                  'Year in Reading recap (delivered December 1st, or any date range you choose)',
                  'Reading personality that updates continuously as you read (not just on book finish)',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="discover"
            eyebrow="Discover"
            heading="Find what to read next"
            tier="free"
          >
            <Prose>
              30 celebrity book clubs. 885 historical picks back to 1996.
              Community ratings from readers who actually finished the book.
              The catalog is built to make the next book obvious.
            </Prose>
            <FeatureList
              items={[
                'Browse by mood: dark, lighthearted, emotional, tense, hopeful, funny, mysterious, adventurous, reflective, romantic',
                'Browse award winners: Nobel Prize, Pulitzer, Booker, National Book Award, Hugo',
                'Browse by theme, series, era, or country',
                'Community ratings',
                '30 celebrity book clubs: Oprah, Reese Witherspoon, Jenna Bush Hager, GMA, Barnes & Noble, Belletrist, and more',
                '885 celebrity picks archived back to 1996',
                'New picks auto-discovered every month',
                "Foxing's own Book of the Month with curator notes",
                'Staff picks',
                'Editorial journal: reading guides and author spotlights',
              ]}
            />
          </Section>

          <aside className="mx-auto mt-20 max-w-prose rounded-lg bg-brand-subtle p-6 text-center">
            <p className="font-source-serif-4 text-base text-text-secondary leading-[1.7]">
              Foxing is free to read. Plus ($12.99/month or $129.99/year) adds
              unlimited AI, book club creation, and more. 7-day free trial, no
              credit card.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/sign-up">
                <Button variant="primary" size="md">
                  Join free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" size="md">
                  See pricing
                </Button>
              </Link>
            </div>
          </aside>
        </article>
      </main>
      <Footer />
    </div>
  )
}

interface SectionProps {
  id: string
  eyebrow: string
  heading: string
  tier?: 'free' | 'plus'
  children: ReactNode
}

function Section({ id, eyebrow, heading, tier, children }: SectionProps) {
  return (
    <section
      id={id}
      className="mt-16 border-t border-border-subtle pt-12 first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <p className="mb-2 font-dm-mono text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
        {eyebrow}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-fraunces text-[1.625rem] text-text-primary">
          {heading}
        </h2>
        {tier ? <TierBadge tier={tier} /> : null}
      </div>
      {children}
    </section>
  )
}

interface SubgroupProps {
  title?: string
  tier?: 'free' | 'plus'
  meta?: string
  children: ReactNode
}

function Subgroup({ title, tier, meta, children }: SubgroupProps) {
  if (!title && !tier && !meta) {
    return <div className="mt-4">{children}</div>
  }
  return (
    <div className="mt-8">
      {title || tier || meta ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title ? (
            <h3 className="font-fraunces text-[1.125rem] text-text-primary">
              {title}
            </h3>
          ) : null}
          {tier ? <TierBadge tier={tier} /> : null}
          {meta ? (
            <span className="font-dm-sans text-xs text-text-tertiary">
              {meta}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function TierBadge({ tier }: { tier: 'free' | 'plus' }) {
  if (tier === 'free') return <Badge variant="neutral">Free</Badge>
  return <Badge variant="brand">Plus</Badge>
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <p className="font-source-serif-4 text-base text-text-secondary leading-[1.85]">
      {children}
    </p>
  )
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="font-dm-sans text-[0.9375rem] text-text-secondary"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
