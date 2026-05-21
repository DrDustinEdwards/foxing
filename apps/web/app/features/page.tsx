import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { NavWithSession } from '@/components/layout/nav-with-session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FREE_AI_LOOKUPS_PER_DAY,
  PLUS_PRICE_COMBINED_LABEL,
  PLUS_PRICE_MONTHLY_LABEL,
  PLUS_TRIAL_LABEL,
} from '@/lib/config'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const metadata = STATIC_PAGE_METADATA['/features']

const NAV_ANCHORS = [
  { href: '#read', label: 'Read' },
  { href: '#formats', label: 'Formats' },
  { href: '#navigate', label: 'Navigate' },
  { href: '#annotate', label: 'Annotate' },
  { href: '#track', label: 'Track' },
  { href: '#stats', label: 'Stats' },
  { href: '#ai', label: 'AI Companion' },
  { href: '#vocabulary', label: 'Vocabulary' },
  { href: '#clubs', label: 'Clubs' },
  { href: '#social', label: 'Social' },
  { href: '#discover', label: 'Discover' },
  { href: '#profile', label: 'Profile' },
  { href: '#commonplace', label: 'Commonplace' },
  { href: '#organize', label: 'Organize' },
  { href: '#import', label: 'Import & Export' },
  { href: '#platform', label: 'Platform' },
]

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Suspense fallback={<Nav user={null} />}>
        <NavWithSession />
      </Suspense>
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[900px] px-6 py-16">
          <header>
            <h1 className="font-fraunces text-[2.5rem] text-text-primary">
              What Foxing does
            </h1>
            <p className="mt-4 font-source-serif-4 text-base text-text-secondary leading-[1.85]">
              Everything on this page is available today. Free and Plus (
              {PLUS_PRICE_MONTHLY_LABEL}) features are labeled. Sections marked
              App only or Web only are limited to that surface.
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
            platform="app"
          >
            <Prose>
              Every book on Foxing is from the public domain. Frankenstein,
              Pride and Prejudice, Sherlock Holmes, Moby-Dick, Dracula, Crime
              and Punishment, and 1,400 more. Free to read in full. No
              subscription required to open a book.
            </Prose>
            <FeatureList
              items={[
                'Read on iOS, Android, and web: same library, same position, everywhere',
                'Paginated reading mode with page-turn animations',
                'Continuous scroll mode',
                'Dual-page layout on tablet and landscape',
                'Four reading canvas themes: Default (warm white), Sepia (parchment), Dark (warm near-black), OLED Black (true black for battery saving)',
                'Font size adjustment',
                'Line height, letter spacing, and margin width controls',
                'Justified, left-aligned, or right-aligned text',
                'Full-screen reading mode (hides all interface chrome)',
                'Reading progress saved automatically and synced across devices',
                'Reading position restored on every open',
                'Keep screen awake while reading',
                'Battery and time display while reading',
                'Reading progress bar at top or bottom',
                'Estimated time remaining (per chapter and whole book)',
                'Chapter name and book title display while reading',
                'Reading lock mode (prevents accidental taps mid-session)',
              ]}
            />
          </Section>

          <Section
            id="formats"
            eyebrow="Formats"
            heading="Every major reading format"
            tier="free"
            platform="app"
          >
            <FeatureList
              items={[
                'EPUB 2 and EPUB 3',
                'EPUB fixed layout',
                'PDF',
                'MOBI and AZW3',
                'CBZ and CBR (comics)',
                'TXT and Markdown',
                'HTML',
                'RTF and DOCX',
                'FictionBook (FB2)',
                'Sideload personal files via the app (import from Files, Dropbox, or email attachment) (app only)',
              ]}
            />
          </Section>

          <Section
            id="navigate"
            eyebrow="Navigate"
            heading="Get anywhere in a book instantly"
            tier="free"
            platform="app"
          >
            <FeatureList
              items={[
                'Table of contents with nested chapter structure',
                'Search within a book (full-text search with highlighted results and context previews)',
                'Jump to chapter, page number, or percentage',
                'Go to previous or next chapter',
                'Back navigation (return to where you jumped from)',
                'Named bookmarks with quick-add, view and delete bookmarks from the web on any book detail page',
                'Bookmark notes',
                'History of recently visited positions',
                'Internal hyperlink navigation (footnotes, endnotes, cross-references)',
                'Go to footnote and return',
                'Swipe gesture navigation',
                'Volume button page turn',
                'Tap zones (left tap back, right tap forward, customizable)',
              ]}
            />
          </Section>

          <Section
            id="annotate"
            eyebrow="Annotate"
            heading="Highlight everything, forget nothing"
            tier="free"
            platform="app"
          >
            <Prose>
              Seven highlight colors. Notes on any passage. Everything
              searchable and exportable.
            </Prose>

            <Subgroup title="Highlight colors" tier="free">
              <FeatureList
                items={[
                  'Amber: key ideas',
                  'Auburn: emotional moments',
                  'Yellow: important passages',
                  'Sage: passages you love',
                  'Cobalt: research later',
                  'Crimson: questions',
                  'Purple: disagree',
                ]}
              />
            </Subgroup>

            <Subgroup title="Selection and creation" tier="free">
              <FeatureList
                items={[
                  'Long press to begin a selection',
                  'Double tap to select a word',
                  'Triple tap to select a sentence or paragraph',
                  'Drag handles to extend a selection',
                  'Highlight with or without a note',
                  'Strikethrough and underline annotations',
                  'Circle and box annotations (PDF)',
                  'Sticky margin notes',
                  'Free-draw annotation (PDF)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Annotation management" tier="free" platform="both">
              <FeatureList
                items={[
                  'Annotation list: all highlights and notes in one scrollable view',
                  'Filter annotations by color, chapter, or date',
                  'Sort by position, date added, or color',
                  'Search within your annotations',
                  'Edit any note after creation',
                  'Export annotations as TXT, CSV, or Markdown',
                  'Share any annotation directly',
                  'Annotation sync across all your devices',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="track"
            eyebrow="Track"
            heading="Keep track of what you read"
            tier="free"
          >
            <Prose>
              Every book you have read, every book you want to read, every
              thought you had while reading it. Your reading life in one place.
            </Prose>

            <Subgroup title="Shelves" tier="free">
              <FeatureList
                items={[
                  'Currently Reading',
                  'Want to Read',
                  'Finished',
                  'Paused',
                  'Set Aside (did not finish)',
                  'Custom reading lists (public or private, shareable by link)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Per-book details" tier="free">
              <FeatureList
                items={[
                  'Half-star ratings on a 10-point scale (3.5 stars is a real value)',
                  'Written review, public or private',
                  'Private notes per book',
                  'Start and finish dates with backdating support',
                  'Mood tags: dark, lighthearted, emotional, tense, hopeful, funny, mysterious, adventurous, reflective, romantic',
                  'Pacing tags: fast, medium, slow',
                  'Format read: ebook, physical, audiobook',
                  'Re-read tracking (multiple read-throughs per book)',
                  'Mark as favorite',
                ]}
              />
            </Subgroup>

            <Subgroup title="Reading diary" tier="free">
              <FeatureList
                items={[
                  'Letterboxd-style diary: dated log entries per book',
                  'List view (reverse chronological) and calendar view (monthly grid with highlighted dates)',
                  'Year filter (current year and past years)',
                  'Log Entry dialog with book search, date picker, rating, review, and privacy selector',
                  'Public diary on your profile (optional)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Reading timer" tier="free" platform="both">
              <FeatureList
                items={[
                  'Start and stop a reading session from any book page',
                  'Elapsed time display while a session is active',
                  'Pages-read input on session end',
                  'Words per minute calculation when page count is provided',
                  'Session history on your stats page (date, duration, pages, WPM)',
                  'Active session auto-closes on app exit',
                ]}
              />
            </Subgroup>

            <Subgroup title="Chapter reactions" tier="free">
              <FeatureList
                items={[
                  'React to any chapter with 8 emojis: 😭 😂 😱 😤 🥺 🤯 ❤️ 🙃',
                  'Add an optional note to any reaction',
                  'Privacy control per reaction: Public, Close friends only, or Private',
                  'Community chapter reactions visible on every book page (aggregated by emoji)',
                  'Delete your own reactions',
                ]}
              />
            </Subgroup>

            <Subgroup title="Custom shelves" tier="free">
              <FeatureList
                items={[
                  'Create named shelves beyond the 5 presets: examples include "own physical copy", "lent to friend", "ARCs", "to reread"',
                  'Up to 50 custom shelves per account',
                  'Add any book to one or more custom shelves from the book page or library',
                  'Public or private shelf toggle',
                  'Public shelves visible on your profile at /u/[username]/shelves/[id]',
                  'Custom tags on any book: lowercase labels like "favorite", "gift-idea", "challenging" (up to 20 tags per book)',
                  'Tags appear as pills on library cards',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="stats"
            eyebrow="Stats"
            heading="See how you read"
            tier="free"
          >
            <Subgroup title="Summary cards" tier="free">
              <FeatureList
                items={[
                  'Books finished (this year and all time)',
                  'Pages read (estimated from word count)',
                  'Average rating across all finished books',
                  'Current reading streak and longest streak ever',
                  'Total reading time (hours and minutes from reading sessions)',
                  'Average book length (words) for finished books',
                  'Longest book you have finished (title and word count)',
                  'Most-read author (name and book count)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Charts" tier="free">
              <FeatureList
                items={[
                  'Books per month bar chart (last 12 months)',
                  'Genre breakdown donut chart (top 8 genres from your books)',
                  'Mood distribution horizontal bar chart (top 6 moods from finished books)',
                  'Reading pace over time line chart (average WPM per month, requires session data)',
                  'Format breakdown (physical, ebook, audiobook counts)',
                  'Reading activity heatmap (last 52 weeks, GitHub-style)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Filters" tier="free">
              <FeatureList
                items={[
                  'Year filter: view any calendar year or all time',
                  'All stats update when a year is selected',
                ]}
              />
            </Subgroup>

            <Subgroup title="Year in Reading" tier="plus">
              <FeatureList
                items={[
                  'Full annual recap: every book, in order, with ratings and dates',
                  'Longest and shortest book of the year',
                  'Most active reading month',
                  'Top author',
                  'Mood and genre distribution for the year',
                  'Available any time (not just December)',
                  'Shareable recap card',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="ai"
            eyebrow="AI Companion"
            heading="An AI that reads alongside you"
            platform="app"
          >
            <Prose>
              Tap any word and Foxing explains it in context: the way that word
              is being used in that sentence in that book, not a dictionary
              definition. That is the simplest thing the AI companion does.
            </Prose>

            <Subgroup
              title="Word level"
              meta={`Free: ${FREE_AI_LOOKUPS_PER_DAY}/day. Plus: unlimited`}
            >
              <FeatureList
                items={[
                  'Definition in context (specific to the sentence and book, not generic)',
                  'Etymology and historical usage',
                  'Synonyms and antonyms',
                  'How the word is used in other literature',
                  'Pronunciation guide',
                  'Word automatically saved to your vocabulary list',
                ]}
              />
            </Subgroup>

            <Subgroup title="Passage level" tier="plus">
              <FeatureList
                items={[
                  'Plain English rewrite of a difficult passage',
                  'Historical context for what the passage describes',
                  'Literary devices identified: metaphor, irony, foreshadowing, alliteration, and more',
                  'Mood and tone analysis of the passage',
                  'Why the passage matters in the larger book',
                  'Character motivation in the scene',
                  'Narrative perspective notes',
                ]}
              />
            </Subgroup>

            <Subgroup title="Chapter level" tier="plus">
              <FeatureList
                items={[
                  'Summary before you start (catch up if you are returning to the book)',
                  'Summary after you finish (consolidate what you read)',
                  'Key events in the chapter in order',
                  'Characters who appeared and what they did',
                  'Themes introduced or developed',
                  'Pacing analysis (action or reflection, fast or slow)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Whole book" tier="plus">
              <FeatureList
                items={[
                  'Full book summary',
                  'Character map with all relationships visualized',
                  'Character arc tracker',
                  'Theme and motif analysis',
                  'Author biography',
                  'Historical context for when the book was written',
                  "Author's other works and how this book fits",
                ]}
              />
            </Subgroup>

            <Subgroup title="AI Deep Dive" tier="plus">
              <FeatureList
                items={[
                  'Character arc analysis',
                  'Symbolism index (major symbols and their meanings)',
                  'Literary criticism digest (what scholars and critics have said)',
                  'Influence map (what influenced this book and what it went on to influence)',
                  "Narrative structure analysis (three-act, hero's journey, etc.)",
                  'Point of view analysis',
                  'Setting analysis (places and their significance)',
                  'First-read vs. second-read guide (things to notice on a reread)',
                  'Reading difficulty score',
                ]}
              />
            </Subgroup>

            <Subgroup title="AI companion chat" tier="plus">
              <FeatureList
                items={[
                  'Ask anything about the book at any point',
                  'Spoiler-free mode: the AI will not reveal what comes later',
                  'Spoiler-full mode: ask about the ending, themes, or anything else',
                  'Socratic mode: the AI asks you questions instead of answering',
                  'Character interview mode: talk to a character as if they are real',
                  'Author perspective mode: the AI explains choices as the author',
                  'Scholar mode: academic literary criticism style responses',
                  'Prediction mode: discuss what you think will happen before reading further',
                  'Reading journal prompt generator',
                ]}
              />
            </Subgroup>

            <Subgroup title="Discussion questions" tier="free" platform="both">
              <FeatureList
                items={[
                  '12 to 15 AI-generated discussion questions per book',
                  'Questions grouped by theme: Characters, Plot, Themes, Setting, Writing Style, Personal Response, Broader Context',
                  'Copy all questions to clipboard',
                  'Available on every book page',
                  'Available inside club threads for the current club book',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="vocabulary"
            eyebrow="Vocabulary"
            heading="A vocabulary that grows every time you read"
            tier="free"
          >
            <Prose>
              Every word you look up is saved with its definition and the
              sentence you found it in. Over time you build a personal glossary
              of every word you have ever looked up, searchable and exportable.
            </Prose>
            <FeatureList
              items={[
                'Every looked-up word saved automatically with definition, etymology, and context sentence',
                'Filter by book title',
                'Search by word',
                'Filter to show only unmastered or mastered words',
                'Mark words as mastered',
                'Word count per book',
                'Export as CSV (word, definition, context, book, mastered status, date)',
                'Export as Anki flashcard deck (front: word, back: definition and context, tag: book title)',
              ]}
            />
          </Section>

          <Section
            id="clubs"
            eyebrow="Clubs"
            heading="Read with other people"
          >
            <Prose>
              Public reading profiles. Inline passage comments tied to the
              exact line that prompted them. Book clubs with chapter-by-chapter
              discussions. The social layer is built around the books, not
              engagement metrics.
            </Prose>

            <Subgroup
              title="Club structure"
              meta="Free: join up to 1. Plus: create unlimited"
            >
              <FeatureList
                items={[
                  'Public clubs (open to anyone), private clubs (invite only), secret clubs (join by link only)',
                  'Multiple admins and co-moderators',
                  'Member cap with optional waitlist',
                  'Member approval (admin must approve join requests)',
                  'Member roles: admin, moderator, member',
                  'Member invites by username or email',
                  'Club description, cover image, and genre tags',
                  'Club library at /clubs/[slug]/library: every book the club has read together, in order',
                  'Request to join flow for approval-required clubs (request sent, pending admin approval)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Discussion threads" tier="free">
              <FeatureList
                items={[
                  '11 thread types: General, Chapter, Prediction, First Impressions, Deep Dive, Hot Take, Quote, Character, Theme, Questions, Wrap-Up',
                  'Chapter-gated threads (locked until the scheduled unlock date)',
                  'Nested replies on every post',
                  'Rich text formatting (bold, italic, block quote)',
                  'Spoiler tagging and blur on any post',
                  'Like and save individual posts',
                  'Report a post',
                  'AI-generated discussion starter questions per chapter',
                  'AI discussion summary (catch up on what was discussed while you were away)',
                  'Full thread reading view at /clubs/[slug]/threads/[id] with inline save, report, and reply on every post (web)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Inline passage comments" tier="plus" platform="app">
              <FeatureList
                items={[
                  'Leave a comment anchored to the exact position in the text',
                  "See other club members' comments inline while you read",
                  'Threaded replies on any inline comment',
                  'Emoji reactions on passage comments',
                  'Spoiler-tagged inline comments (hidden until the reader reaches that point)',
                  'Private, club-visible, or public visibility per comment',
                  'Pin an important comment to a passage for the whole club',
                ]}
              />
            </Subgroup>

            <Subgroup title="Meeting scheduling" tier="free">
              <FeatureList
                items={[
                  'Schedule a meeting with title, date, time, and end time',
                  'Meeting types: in person, virtual, or hybrid',
                  'Location name and address (or video call link for virtual)',
                  'Link a specific book to the meeting',
                  "RSVP: Going, Maybe, or Can't make it",
                  'RSVP count displayed per meeting',
                  'Optional attendance limit',
                  'Download a calendar file (.ics) for any meeting',
                  'Recurring meetings: weekly, biweekly, or monthly',
                  'Virtual and hybrid meetings auto-generate a Google Meet link when no video URL is provided',
                  'Mod controls to edit or cancel meetings',
                  'Club members notified when a meeting is scheduled',
                ]}
              />
            </Subgroup>

            <Subgroup title="Book selection polls" tier="free">
              <FeatureList
                items={[
                  'Create a poll to vote on the next book',
                  'Single choice or ranked choice voting',
                  'Up to 8 options per poll with optional book links',
                  'Optional close date',
                  'Vote counts and percentage bars visible after voting',
                  'Ranked choice winner calculated automatically (instant-runoff)',
                  'Change your vote before the poll closes',
                  'Mods can close a poll at any time',
                  'Club members notified when a poll is created',
                ]}
              />
            </Subgroup>

            <Subgroup title="Moderation" tier="free">
              <FeatureList
                items={[
                  'Mute a member for 1 hour, 24 hours, 7 days, or permanently',
                  'Ban a member with a required reason (audit trail)',
                  'Remove any post with a reason',
                  'Change member roles',
                  'Remove a member from the club',
                ]}
              />
            </Subgroup>

            <Subgroup title="Reading schedule" tier="free">
              <FeatureList
                items={[
                  'Set chapter unlock dates for a structured reading pace',
                  'Each entry: chapter name and unlock date',
                  'Status chips: Upcoming, Today, Unlocked',
                  'Mod-only controls to add and delete schedule entries',
                  'Members see the full schedule view',
                ]}
              />
            </Subgroup>

            <Subgroup title="Club waitlist" tier="free">
              <FeatureList
                items={[
                  'When a club reaches its member cap, a waitlist button replaces Join',
                  'Members can leave the waitlist at any time',
                  'Admins see the waitlist count in the moderation panel',
                ]}
              />
            </Subgroup>

            <Subgroup title="Reported posts" tier="free">
              <FeatureList
                items={[
                  'Flag any post with a reason: Spam, Harassment, Spoilers without tag, Offensive content, Other',
                  'Reports appear in the club moderation panel with pending count badge',
                  'Moderators can dismiss, remove the post, or ban the author from the reports panel',
                ]}
              />
            </Subgroup>

            <Subgroup title="Club settings" meta="admins only">
              <FeatureList
                items={[
                  'Rename the club, update description, visibility, and member settings',
                  'Change the current book the club is reading',
                  'Transfer ownership to another member',
                  'Delete the club (requires typing the club name to confirm)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Discord integration" tier="free" platform="web">
              <FeatureList
                items={[
                  'Connect any club to a Discord channel via a webhook URL',
                  'Foxing posts to the Discord channel automatically when a meeting is scheduled, a poll is created, an announcement is pinned, or a member finishes the club book',
                  'Configure and remove the webhook from club settings (admins only)',
                  'Webhook URL is masked after saving',
                  'Test button sends a confirmation message to the channel',
                ]}
              />
            </Subgroup>

            <Subgroup title="Author Q&A" tier="free">
              <FeatureList
                items={[
                  'Verified authors can answer reader questions on their author page',
                  'Readers ask questions on any author page (10 to 500 characters, up to 3 questions per reader per author)',
                  'Answered questions listed publicly, most upvoted first',
                  'Upvote questions to surface the best ones',
                  'Authors manage unanswered questions from their author dashboard',
                  'Author verification via email domain (submit a claim from Settings)',
                  'Verified badge on author pages and public profiles',
                ]}
              />
            </Subgroup>

            <Subgroup
              title="Bookstore and library clubs"
              meta="verified by Foxing"
            >
              <FeatureList
                items={[
                  'Verified fox badge on club page',
                  'Address, phone number, website, and hours displayed on club page',
                  'Events appear on the public geographic events feed at foxing.app/events',
                  'State, city, and author-filtered event pages',
                  '.ics calendar file for every event',
                  'Events appear in the bookstore events feed when a city is searched',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="social"
            eyebrow="Social"
            heading="Reading as a shared experience"
          >
            <Subgroup title="Highlights" tier="free">
              <FeatureList
                items={[
                  "Public highlights appear on your profile and the book's page",
                  'Other readers can like your highlights; like counts shown on every quote card',
                  'Community highlights feed at foxing.app/quotes',
                  'Individual quote pages (shareable link)',
                  'Passage of the Day on the home page (from community highlights, changes daily)',
                  'Dedicated passage page with share button and app deeplink',
                ]}
              />
            </Subgroup>

            <Subgroup title="Book discussions" tier="free">
              <FeatureList
                items={[
                  'Public discussion threads on every book page',
                  '11 thread types: General, Chapter, Prediction, First Impressions, Deep Dive, Hot Take, Quote, Character, Theme, Questions, Wrap-Up',
                  'Threaded replies (one level deep)',
                  '6 emoji reactions per post',
                  'Spoiler tagging on any post',
                  'Edit and delete your own posts',
                  'Sign-in gate for new discussions (read-only for anonymous visitors)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Community chapter reactions" tier="free">
              <FeatureList
                items={[
                  'Chapter reactions from all public readers visible on every book page',
                  'Reactions grouped by chapter and aggregated by emoji',
                  'Spoiler protection: reactions from chapters ahead of your estimated position are blurred by default',
                  'Reveal any blurred chapter with one tap',
                  'Add your own reaction directly from the book page',
                ]}
              />
            </Subgroup>

            <Subgroup title="Commonplace book" tier="free">
              <FeatureList
                items={[
                  'A personal anthology of your favorite passages',
                  'Save any passage from any book with an optional note',
                  'Public or private per entry',
                  'Filter by public or private',
                  'Export all entries as formatted plain text',
                  'Public entries appear on your profile and at /u/[username]/commonplace',
                ]}
              />
            </Subgroup>

            <Subgroup title="Buddy reads" tier="plus" platform="app">
              <FeatureList
                items={[
                  'Read a book one-on-one with another reader',
                  'Chapter and page-anchored posts (spoiler protection built in)',
                  'Invite any reader you follow',
                ]}
              />
            </Subgroup>

            <Subgroup title="Saved posts" tier="free">
              <FeatureList
                items={[
                  'Save any club post for later',
                  'View all saved posts at /saved-posts',
                  'Posts show club name, thread title, and author',
                  'Remove from saved at any time',
                ]}
              />
            </Subgroup>

            <Subgroup title="Close friends" tier="free">
              <FeatureList
                items={[
                  'Manage a private list of close friends from settings',
                  'Close-friends-only visibility option on chapter reactions and passage comments',
                  'Only people you follow can be added as close friends',
                ]}
              />
            </Subgroup>

            <Subgroup title="Following" tier="free">
              <FeatureList
                items={[
                  'Follow any public reader',
                  'Activity feed: what friends are reading, finishing, and reviewing',
                  "See a friend's reading progress (if they have progress visible)",
                  "Taste compatibility score when viewing another reader's profile (genre overlap percentage)",
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
            </Prose>

            <Subgroup title="Browse the catalog" tier="free">
              <FeatureList
                items={[
                  'Browse by mood: dark, lighthearted, emotional, tense, hopeful, funny, mysterious, adventurous, reflective, romantic',
                  'Browse by theme: revenge, identity, survival, coming of age, and more',
                  'Browse by genre, era, country of origin, and series',
                  'Browse award winners: Nobel Prize, Pulitzer, Booker Prize, National Book Award, Hugo Award',
                  'Browse by reading difficulty',
                  'Search by title, author, or keyword',
                  'Community ratings on every book (weighted by number of ratings)',
                  'Content warnings on books that have them',
                  'Series display with reading order',
                ]}
              />
            </Subgroup>

            <Subgroup title="Celebrity book clubs" tier="free">
              <FeatureList
                items={[
                  '30 celebrity clubs: Oprah, Reese Witherspoon, Jenna Bush Hager, GMA Book Club, Barnes and Noble Book Club, Belletrist, Dua Lipa, and more',
                  '885 historical picks archived back to 1996',
                  'New picks auto-discovered every month',
                  'Monthly roundup pages for every month going back 25 years',
                  'Individual pick pages with curator quotes and affiliate links',
                  'Era grouping (by decade) on every club page',
                ]}
              />
            </Subgroup>

            <Subgroup title="Editorial" tier="free">
              <FeatureList
                items={[
                  'Foxing Book of the Month with curator notes',
                  'Staff picks',
                  'Editorial journal: reading guides, author spotlights, and thematic essays',
                  'RSS feed for the journal (subscribe in any reader)',
                  'Reading challenges: join a shared reading goal with the community',
                  'Community reading lists: public lists from any reader, like a list to save it, sortable by most liked',
                ]}
              />
            </Subgroup>

            <Subgroup title="Book giveaways" tier="free">
              <FeatureList
                items={[
                  'Verified authors run free book giveaways on Foxing',
                  'Browse active giveaways at /giveaways (digital and physical)',
                  'Enter any giveaway with one tap (authenticated users only)',
                  'Winners selected randomly when the giveaway closes',
                  'Notified via the notifications inbox when you win',
                  'Verified authors create giveaways from their author dashboard',
                ]}
              />
            </Subgroup>

            <Subgroup title="AI recommendations" tier="plus">
              <FeatureList
                items={[
                  'Mood-based recommendation quiz (Find Next Book)',
                  'Recommendations explained: "because you read..." reasoning',
                  'Personalized homepage recommendations based on reading history',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="profile"
            eyebrow="Profile"
            heading="Your reading identity"
            tier="free"
          >
            <FeatureList
              items={[
                'Public reading personality line (one sentence, auto-generated by AI from your reading history, updated after every 10 books finished)',
                'Verified author badge for authors who claim their profile via email verification',
                'Author dashboard for verified authors: answer Q&As, create giveaways, view reader stats',
                'Display name, username, bio, and avatar',
                '5 favorite books on your profile (with dashed slots for unfilled positions)',
                'Stats row: books read, highlights, following, followers',
                'Currently reading with progress bar (optional, can be hidden)',
                'Recent reviews',
                'Public diary (optional)',
                'Public highlights',
                'Public reading lists',
                'Taste compatibility score when another reader views your profile',
                'Follow and be followed',
                'Public or private profile (private shows nothing to non-followers)',
                'Compare stats side-by-side with any public reader at /u/[username]/compare',
                'Find readers with similar taste at /people/similar (matched by books in common and genre overlap)',
              ]}
            />

            <Subgroup title="Badges and XP" tier="free">
              <FeatureList
                items={[
                  'Earn badges for reading milestones, streaks, social actions, and club activity',
                  '12 badge types across 5 categories: Reading, Social, Streaks, Clubs, Milestones',
                  'Badges displayed on your public profile (top 8 with tooltip)',
                  'Full badge page showing all earned and locked badges grouped by category',
                  'XP points earned for every badge unlocked',
                  'Reading level that grows with XP: Bookworm, Reader, Avid Reader, Bibliophile, Scholar',
                  'XP progress bar on your home dashboard showing current level and next threshold',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="commonplace"
            eyebrow="Commonplace Book"
            heading="Your personal anthology"
            tier="free"
          >
            <Prose>
              Save the passages that stay with you. Your commonplace book is a
              curated collection of lines from everything you have read, with
              notes and the book they came from.
            </Prose>
            <FeatureList
              items={[
                'Personal anthology page at /commonplace',
                'Each entry shows the passage, book title and author, your note (if any), and date added',
                'Public or private per entry',
                'Filter to show only public or only private entries',
                'Export all entries as formatted plain text (passage, book, author, note)',
                'Photo-to-quote: take a photo of a physical book page, AI extracts the text and saves it as a commonplace entry (mobile app)',
                'Public entries visible on your profile and at /u/[username]/commonplace',
                'Public entries appear as blockquotes in the style of the reading canvas',
              ]}
            />
          </Section>

          <Section
            id="organize"
            eyebrow="Organize"
            heading="Goals, streaks, and challenges"
            tier="free"
          >
            <Subgroup title="Reading goals" tier="free">
              <FeatureList
                items={[
                  'Annual reading goal with progress bar and percentage, set and edited directly from the web',
                  'Monthly reading goal: set a target for the current month with live progress',
                  'Weekly reading goal: set a target for the current week with live progress',
                  'Reading streak tracking (current streak and longest streak ever)',
                  'Reading activity heatmap (last 52 weeks, GitHub-style)',
                  'Daily reading reminder (set your preferred time)',
                  'Streak freeze credits (protect a streak you would otherwise break)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Community challenges" tier="free">
              <FeatureList
                items={[
                  'Join a shared community reading challenge',
                  'Track your progress per challenge',
                  'See how many others have joined each challenge',
                  'Leave a challenge at any time',
                ]}
              />
            </Subgroup>

            <Subgroup title="Continuous reading personality" tier="plus">
              <FeatureList
                items={[
                  'Reading personality updates after every book you finish, not just annually',
                  'Reflects current reading patterns, not just all-time history',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="import"
            eyebrow="Import and Export"
            heading="Bring your data in. Take it out."
            tier="free"
          >
            <Subgroup title="Import" tier="free">
              <FeatureList
                items={[
                  'Goodreads CSV import: upload your Goodreads export, preview before anything is saved, matches by title and author, copies ratings, reviews, shelves, and finish dates',
                  'Shows matched count, inserted count, and unmatched titles after import',
                  'StoryGraph JSON import (mobile app)',
                  'Sideload personal EPUB files into your reading library',
                  'Barcode scanner: point the camera at the back of a physical book to add it by ISBN (mobile app)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Export" tier="free">
              <FeatureList
                items={[
                  'Export your full library as CSV (title, author, status, rating, review, dates)',
                  'Export your vocabulary list as CSV',
                  'Export your vocabulary as an Anki flashcard deck (.txt, tab-separated)',
                  'Export annotations as TXT, CSV, or Markdown',
                  'Download .ics calendar files for any club meeting or bookstore event',
                ]}
              />
            </Subgroup>
          </Section>

          <Section
            id="platform"
            eyebrow="Platform"
            heading="Available everywhere"
            tier="free"
          >
            <Subgroup title="Apps and platforms" tier="free">
              <FeatureList
                items={[
                  'iOS app (iPhone and iPad)',
                  'Android app',
                  'Web app at foxing.app (full reading and social features)',
                  'Tablet-optimized layout',
                  'macOS desktop app (via web)',
                ]}
              />
            </Subgroup>

            <Subgroup title="Sync and offline" tier="free" platform="app">
              <FeatureList
                items={[
                  'Reading position synced across all devices in real time',
                  'Annotations synced across all devices',
                  'Offline reading (books downloaded for reading without a connection)',
                  'Offline annotation sync (syncs when back online)',
                  'Background sync',
                ]}
              />
            </Subgroup>

            <Subgroup title="Accessibility" tier="free" platform="app">
              <FeatureList
                items={[
                  'VoiceOver (iOS) and TalkBack (Android) full support',
                  'Text to speech with voice selection, speed control, and pitch control',
                  'TTS auto-advance (reads continuously through chapters)',
                  'Sleep timer for text to speech',
                  'OpenDyslexic font option',
                  'Dyslexia-friendly layout preset (wider spacing, shorter lines, wider margins)',
                  'High contrast mode',
                  'Reduced motion mode (respects system preference)',
                  'Large text mode (respects system Dynamic Type)',
                  'Color blindness accommodations',
                  'Right-to-left language support (Arabic, Hebrew)',
                  'WCAG 2.2 AA contrast throughout, AAA on body text',
                  'Keyboard navigation with visible focus rings throughout',
                ]}
              />
            </Subgroup>

            <Subgroup title="Privacy and security" tier="free">
              <FeatureList
                items={[
                  'Private profile option (nothing visible to non-followers)',
                  'Private reviews, notes, and diary entries',
                  'Granular notification controls (opt out per category)',
                  'Quiet hours setting for notifications',
                  'Full data export (everything Foxing stores about you)',
                  'Account deletion (removes all personal data)',
                  'HTTPS everywhere with HSTS',
                  'Content Security Policy and X-Frame-Options headers',
                ]}
              />
            </Subgroup>

            <Subgroup title="Notifications" tier="free">
              <FeatureList
                items={[
                  'Notification inbox for club events, announcements, and activity',
                  'Unread count badge on the bell icon in the navigation',
                  'Mark all notifications as read in one tap',
                  'Notifications for club meetings, polls, announcements, and new members',
                ]}
              />
            </Subgroup>

            <Subgroup title="Discord Activity" tier="free" platform="web">
              <FeatureList
                items={[
                  'Launch Foxing inside any Discord voice or text channel as an embedded Activity',
                  'Shared real-time club dashboard visible to everyone in the channel',
                  'Vote on book selection polls without leaving Discord',
                  'Run a group reading sprint with a shared countdown timer',
                  'View AI discussion questions and chapter reactions mid-discussion',
                  'Connect your Foxing account via Discord OAuth in one tap',
                ]}
              />
            </Subgroup>
          </Section>

          <aside className="mx-auto mt-20 max-w-prose rounded-lg bg-brand-subtle p-6 text-center">
            <p className="font-source-serif-4 text-base text-text-secondary leading-[1.7]">
              Foxing is free to read. Plus ({PLUS_PRICE_COMBINED_LABEL}) adds
              unlimited AI, book club creation, and more. {PLUS_TRIAL_LABEL}, no
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

type Platform = 'app' | 'web' | 'both'

interface SectionProps {
  id: string
  eyebrow: string
  heading: string
  tier?: 'free' | 'plus'
  platform?: Platform
  children: ReactNode
}

function Section({
  id,
  eyebrow,
  heading,
  tier,
  platform,
  children,
}: SectionProps) {
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
        {platform ? <PlatformBadge platform={platform} /> : null}
      </div>
      {children}
    </section>
  )
}

interface SubgroupProps {
  title?: string
  tier?: 'free' | 'plus'
  platform?: Platform
  meta?: string
  children: ReactNode
}

function Subgroup({
  title,
  tier,
  platform,
  meta,
  children,
}: SubgroupProps) {
  if (!title && !tier && !meta && !platform) {
    return <div className="mt-4">{children}</div>
  }
  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title ? (
          <h3 className="font-fraunces text-[1.125rem] text-text-primary">
            {title}
          </h3>
        ) : null}
        {tier ? <TierBadge tier={tier} /> : null}
        {platform ? <PlatformBadge platform={platform} /> : null}
        {meta ? (
          <span className="font-dm-sans text-xs text-text-tertiary">
            {meta}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function TierBadge({ tier }: { tier: 'free' | 'plus' }) {
  if (tier === 'free') return <Badge variant="neutral">Free</Badge>
  return <Badge variant="brand">Plus</Badge>
}

function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'both') return null
  return (
    <span className="inline-flex items-center rounded-full border border-border-default px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
      {platform === 'app' ? 'App only' : 'Web only'}
    </span>
  )
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
