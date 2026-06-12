import { type ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import {
  FREE_AI_LOOKUPS_PER_DAY,
  PLUS_TRIAL_LABEL,
} from '@/lib/config'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const dynamic = 'force-static'

export const metadata = STATIC_PAGE_METADATA['/app-guide']

const NAV_ANCHORS = [
  { href: '#reading', label: 'Reading' },
  { href: '#ai', label: 'AI' },
  { href: '#highlights', label: 'Highlights' },
  { href: '#tracking', label: 'Tracking' },
  { href: '#clubs', label: 'Clubs' },
  { href: '#settings', label: 'Settings' },
]

const HIGHLIGHT_COLORS: { name: string; use: string }[] = [
  { name: 'Amber', use: 'key ideas' },
  { name: 'Auburn', use: 'emotional moments' },
  { name: 'Yellow', use: 'important passages' },
  { name: 'Sage', use: 'passages you love' },
  { name: 'Cobalt', use: 'research and reference' },
  { name: 'Crimson', use: 'questions' },
  { name: 'Purple', use: 'passages you disagree with' },
]

export default function AppGuidePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[900px] px-6 py-16">
          <header>
            <h1 className="font-fraunces text-[2.5rem] text-text-primary">
              Using the Foxing app
            </h1>
            <p className="mt-4 font-source-serif-4 text-base text-text-secondary leading-[1.85]">
              How the Foxing mobile app works: reading, AI companion,
              highlights, tracking, clubs, and settings.
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

          <Section id="reading" eyebrow="Reading" heading="Reading">
            <P>
              Open a book from the home screen or your library. If you
              haven&apos;t opened it before, it downloads in a few seconds.
            </P>
            <P>
              Reading themes: tap the Aa icon in the reader. Default (warm
              white), Sepia (parchment), Dark (deep brown-black), OLED Black
              (true black, saves battery on OLED screens).
            </P>
            <P>Font size: slider in the same settings panel.</P>
            <P>
              Your position is saved every time you leave the reader. You
              return to exactly where you left off.
            </P>
            <P>
              Chapter list: in the Aa settings panel. Tap any chapter to jump.
            </P>
            <P>
              Page turns: swipe left or right, or tap the left and right edges
              of the screen.
            </P>
          </Section>

          <Section id="ai" eyebrow="AI" heading="The AI companion">
            <P>
              Word lookup: tap any word for its definition in context. Two
              sentences about what the word means in that sentence, in that
              book. You also get etymology, synonyms, and how the word appears
              in other literature. Free users get {FREE_AI_LOOKUPS_PER_DAY}{' '}
              lookups per day. Plus is unlimited.
            </P>
            <P>
              Passage analysis: long press and drag to select text. A menu
              appears:
            </P>
            <ul className="ml-4 flex flex-col gap-1 font-dm-sans text-[0.9375rem] text-text-secondary">
              <li>
                <strong className="font-medium text-text-primary">
                  Plain English:
                </strong>{' '}
                a clearer version of what the passage is saying.
              </li>
              <li>
                <strong className="font-medium text-text-primary">
                  Historical context:
                </strong>{' '}
                what was happening when this was written.
              </li>
              <li>
                <strong className="font-medium text-text-primary">
                  Literary devices:
                </strong>{' '}
                metaphor, irony, foreshadowing, and others.
              </li>
              <li>
                <strong className="font-medium text-text-primary">
                  Mood and tone:
                </strong>{' '}
                what the passage is doing emotionally.
              </li>
              <li>
                <strong className="font-medium text-text-primary">
                  Ask anything:
                </strong>{' '}
                type your own question.
              </li>
            </ul>
            <P>Passage analysis requires Plus.</P>
            <P>
              Chapter and book tools: the AI icon in the reader bottom bar.
              Chapter summary, full book summary, character map, theme
              analysis, companion chat. All require Plus.
            </P>
            <P>
              AI Deep Dive: in the companion menu, deeper analysis including
              character arcs, symbolism, literary criticism digest, influence
              map, narrative structure, and a guide for rereading. Requires
              Plus.
            </P>
            <P>
              Spoiler protection: the companion defaults to spoiler-free mode.
              Switch to spoiler-full if you want to discuss the ending.
            </P>
            <P>
              Vocabulary: every word you look up is saved automatically. See
              the full list at foxing.app/vocabulary.
            </P>
          </Section>

          <Section id="highlights" eyebrow="Highlights" heading="Highlights">
            <P>
              Tap and drag to select any passage. A color picker appears. Tap a
              color. Add a note if you want.
            </P>
            <p className="font-dm-sans text-[0.9375rem] text-text-secondary">
              7 colors:
            </p>
            <ul className="ml-4 flex flex-col gap-1 font-dm-sans text-[0.9375rem] text-text-secondary">
              {HIGHLIGHT_COLORS.map((c) => (
                <li key={c.name}>
                  <strong className="font-medium text-text-primary">
                    {c.name}:
                  </strong>{' '}
                  {c.use}
                </li>
              ))}
            </ul>
            <P>These are suggestions. Use any color for anything.</P>
            <P>
              If your profile is public, highlights you mark as public appear
              on your profile and on the book&apos;s page on the web. Other
              readers can like them.
            </P>
            <P>
              Commonplace book: from the highlight menu, add any passage to
              your commonplace book. A private collection of passages separate
              from your public highlights.
            </P>
          </Section>

          <Section
            id="tracking"
            eyebrow="Tracking"
            heading="Tracking your reading"
          >
            <P>
              Shelves: mark a book as Finished, Reading, Want to Read, Paused,
              or Set Aside from the library or from inside the reader.
            </P>
            <P>
              When you mark a book Finished, you&apos;re prompted to rate it.
              Half stars: 3.5 or 4.5 are valid. Your rating contributes to the
              community average on the book&apos;s page.
            </P>
            <P>
              Reading diary: from the book detail screen, log an entry.
              Backdate it if you finished it in the past. Entries can be
              private or public.
            </P>
            <P>
              Streaks: every day you open the reader and read anything, your
              streak increments. It appears on the home screen.
            </P>
            <P>
              Goals: set your annual book target in Library → Goals. Progress
              appears there and on foxing.app/goals.
            </P>
          </Section>

          <Section id="clubs" eyebrow="Clubs" heading="Book clubs">
            <P>
              The Clubs tab shows public clubs. Tap any to see details and
              join. Creating a club requires Plus.
            </P>
            <P>
              Discussions inside a club are organized by chapter. Find the
              thread for the chapter you&apos;re on. Spoilers from later
              chapters are behind separate threads tagged for the full book.
            </P>
            <P>
              Passage comments: highlight any text and choose &ldquo;Comment in
              club.&rdquo; Your comment attaches to that exact spot in the
              book. Other members see it when they reach that passage.
            </P>
            <P>
              Announcements: moderators can post announcements and events.
              Events show a date chip and appear in the announcements section.
            </P>
          </Section>

          <Section id="settings" eyebrow="Settings" heading="Settings">
            <P>
              Theme: light or dark, applies everywhere including foxing.app.
            </P>
            <P>
              Reading themes: set per reading session. Saved to the last used
              setting.
            </P>
            <P>Goals: set your annual book target here.</P>
            <P>
              Subscription: manage Plus here. Start the {PLUS_TRIAL_LABEL},
              upgrade, downgrade, or cancel. Billing is through the App Store
              (iOS) or Play Store (Android).
            </P>
            <P>
              Account: display name, bio, profile visibility. Username and
              email changes happen at foxing.app/settings.
            </P>
          </Section>
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
  children: ReactNode
}

function Section({ id, eyebrow, heading, children }: SectionProps) {
  return (
    <section
      id={id}
      className="mt-16 border-t border-border-subtle pt-12 first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <p className="mb-2 font-dm-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary">
        {eyebrow}
      </p>
      <h2 className="mb-4 font-fraunces text-[1.625rem] text-text-primary">
        {heading}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="font-source-serif-4 text-base text-text-secondary leading-[1.85]">
      {children}
    </p>
  )
}
