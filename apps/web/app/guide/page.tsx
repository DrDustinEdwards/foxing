import { type ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const dynamic = 'force-static'

export const metadata = STATIC_PAGE_METADATA['/guide']

const NAV_ANCHORS = [
  { href: '#library', label: 'Library' },
  { href: '#diary', label: 'Diary' },
  { href: '#stats', label: 'Stats' },
  { href: '#goals', label: 'Goals' },
  { href: '#clubs', label: 'Clubs' },
  { href: '#vocabulary', label: 'Vocabulary' },
  { href: '#profile', label: 'Profile' },
  { href: '#settings', label: 'Settings' },
]

export default function GuidePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[900px] px-6 py-16">
          <header>
            <h1 className="font-fraunces text-[2.5rem] text-text-primary">
              Using Foxing on the web
            </h1>
            <p className="mt-4 font-source-serif-4 text-base text-text-secondary leading-[1.85]">
              How the foxing.app web platform works: your library, reading
              diary, stats, book clubs, vocabulary, and settings.
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

          <Section id="library" eyebrow="Library" heading="Your library">
            <P>
              foxing.app/library, or the Library link in the nav once you&apos;re
              signed in.
            </P>
            <P>
              Five shelves: Reading, Want to Read, Finished, Paused, Set Aside.
              Every book you add to a shelf appears here.
            </P>
            <P>
              To add a book from the web: find it on any book page and use the
              shelf selector. From the app: tap the shelf icon while reading or
              on the book detail screen.
            </P>
            <P>
              Sort: the Sort dropdown in the top right. Options: date added,
              date finished, title, author, rating.
            </P>
            <P>
              Goodreads import: tap Import in your library. Upload the CSV from
              Goodreads → My Books → Import and Export → Export Library. Foxing
              shows a preview of every row before saving anything. Books that
              aren&apos;t in the Foxing catalog are listed separately at the
              end.
            </P>
            <P>Export: the Export CSV button downloads your full library.</P>
          </Section>

          <Section id="diary" eyebrow="Diary" heading="Reading diary">
            <P>
              A dated log of your reading. Different from your library in that
              it&apos;s organized by when you finished, not by shelf.
            </P>
            <P>
              Add an entry: the Log Entry button on the diary page. You can
              backdate entries to log books you finished in the past.
            </P>
            <P>
              Views: list (reverse chronological) or calendar (year at a time,
              reading dates highlighted). Toggle between them at the top.
            </P>
            <P>Year filter: tabs for All, 2024, 2025, 2026.</P>
            <P>
              Privacy: entries default to private. Set to public if you want
              them visible on your profile.
            </P>
          </Section>

          <Section id="stats" eyebrow="Stats" heading="Reading stats">
            <P>
              Books finished, estimated pages read, your average rating, your
              current streak. A chart of books per month over the last 12
              months. A genre breakdown from the themes of books you&apos;ve
              finished.
            </P>
            <P>
              Pages are estimated from word count divided by 250. Genre comes
              from each book&apos;s theme tags in the catalog.
            </P>
            <P>
              Your streak is based on activity in the Foxing reader on mobile.
              Every day you open a book and read anything, the streak
              increments. The heatmap on the Goals page shows this activity
              over 52 weeks.
            </P>
          </Section>

          <Section id="goals" eyebrow="Goals" heading="Reading goals">
            <P>
              Set an annual book target in the mobile app under Library →
              Goals. Once set, your progress appears on the Goals page here.
            </P>
            <P>
              The activity heatmap shows 52 weeks of reading activity as a
              grid. Days you read are highlighted.
            </P>
            <P>
              Community challenges are reading goals other Foxing users have
              joined. Tap Join to add one to yours. Your progress updates as
              you finish books.
            </P>
            <P>
              Below the heatmap: current streak, longest streak ever, total
              books finished all time, total highlights all time.
            </P>
          </Section>

          <Section id="clubs" eyebrow="Clubs" heading="Book clubs">
            <P>
              foxing.app/clubs shows public clubs. You can join any of them
              from the web. Discussions happen in the mobile app.
            </P>
            <P>
              Creating a club requires Plus. Clubs can be public (searchable,
              anyone can join), private (joinable by link), or secret (not
              searchable). You can require moderator approval before new
              members join, and set a maximum member count.
            </P>
            <P>
              Moderators can post announcements and events from the club page.
              Events appear with a date chip and also show up on
              foxing.app/events. Each event has an Add to calendar link that
              downloads a .ics file for Google Calendar, Apple Calendar, or
              Outlook.
            </P>
            <P>
              Moderation tools: mute (1 hour, 24 hours, 7 days, or permanent),
              ban (requires a reason for the audit record), remove posts,
              change member roles, invite by username or email.
            </P>
            <P>
              Verified bookstores have a fox badge on their page, along with
              address, hours, and contact info. Their events appear on the
              geographic events feed.
            </P>
          </Section>

          <Section id="vocabulary" eyebrow="Vocabulary" heading="Vocabulary">
            <P>
              Every word you tap in the Foxing reader is automatically saved
              here with its definition, the sentence you found it in, and the
              book it came from.
            </P>
            <P>foxing.app/vocabulary when signed in.</P>
            <P>
              Filter by word text, or by book using the dropdown. Mark words as
              mastered. Export as CSV (for spreadsheets) or Anki (tab-separated,
              imports directly into Anki flashcard software; front is the word,
              back is definition and context, tag is the book name).
            </P>
          </Section>

          <Section id="profile" eyebrow="Profile" heading="Your profile">
            <P>
              If your profile is public, anyone can see your 5 favorite books,
              recent reviews, stats (books, highlights, following, followers),
              and your reading personality.
            </P>
            <P>
              Reading personality: a one-line phrase generated from your
              reading history. Updates when you finish books. With Plus, it
              updates continuously.
            </P>
            <P>
              5 favorite books: set these in the mobile app. They show as cover
              images in a row. Empty slots appear as dashed placeholders.
            </P>
            <P>
              Taste compatibility: when you view another reader&apos;s profile
              while signed in, a percentage badge shows how much your reading
              taste overlaps, based on genre and theme overlap in finished
              books.
            </P>
            <P>
              Follow: from any public profile. Their activity shows in your
              home feed.
            </P>
          </Section>

          <Section id="settings" eyebrow="Settings" heading="Settings">
            <P>
              Account: change your email or username. Both update immediately.
            </P>
            <P>Profile: display name and bio.</P>
            <P>
              Reading profile: toggle public/private. Toggle whether reading
              progress is visible to others.
            </P>
            <P>
              Appearance: light or dark mode. Saved and applied everywhere
              you&apos;re signed in.
            </P>
            <P>
              Subscription: see your current plan. Upgrade to Plus from here.
              If you&apos;re already on Plus, subscription management is in the
              mobile app.
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
      <p className="mb-2 font-dm-mono text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
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
