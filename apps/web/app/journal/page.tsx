import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Card,
  CardBody,
  CardLabel,
  CardMeta,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionEyebrow } from '@/components/ui/section-eyebrow'
import { TagPill } from '@/components/ui/tag-pill'
import { JournalPageShell } from '@/components/journal/JournalPageShell'
import {
  estimateReadingTime,
  getFeaturedJournalPostFullStatic,
  getJournalPostsStatic,
  JOURNAL_TAGS,
  type JournalPostSummary,
} from '@/lib/journal'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Journal · Foxing',
  description:
    'Reading guides, author spotlights, and notes on the classics from the Foxing team.',
  alternates: {
    canonical: 'https://foxing.app/journal',
    types: { 'application/rss+xml': 'https://foxing.app/journal/rss.xml' },
  },
  openGraph: {
    title: 'Foxing Journal',
    description:
      'Reading guides, author spotlights, and notes on the classics.',
    url: 'https://foxing.app/journal',
  },
}

export default async function JournalIndexPage() {
  const [allPosts, featured] = await Promise.all([
    getJournalPostsStatic(),
    getFeaturedJournalPostFullStatic(),
  ])

  const remaining = featured
    ? allPosts.filter((p) => p.slug !== featured.slug)
    : allPosts
  const latest = remaining.slice(0, 4)

  if (allPosts.length === 0) {
    return (
      <JournalPageShell>
        <JournalHeader />
        <div className="mt-12">
          <EmptyState heading="No posts yet." />
        </div>
      </JournalPageShell>
    )
  }

  return (
    <JournalPageShell>
      <JournalHeader />
      {featured && <FeaturedHero post={featured} />}
      {JOURNAL_TAGS.map((tag) => {
        const posts = remaining
          .filter((p) => p.tags.includes(tag.slug))
          .slice(0, 4)
        if (posts.length === 0) return null
        return <CategorySection key={tag.slug} tag={tag} posts={posts} />
      })}
      {latest.length > 0 && <LatestSection posts={latest} />}
    </JournalPageShell>
  )
}

function JournalHeader() {
  return (
    <header className="flex flex-col gap-3">
      <div className="max-w-prose">
        <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
          Journal
        </h1>
        <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
          Notes on the books, the reading habit, and what holds up.
        </p>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 font-dm-sans text-xs text-text-tertiary">
        <Link
          href="/journal/archive"
          className="text-brand-text hover:underline"
        >
          All articles →
        </Link>
        <Link
          href="/journal/rss.xml"
          className="text-brand-text hover:underline"
        >
          RSS feed
        </Link>
      </p>
    </header>
  )
}

function FeaturedHero({
  post,
}: {
  post: Awaited<ReturnType<typeof getFeaturedJournalPostFullStatic>>
}) {
  if (!post) return null
  const minutes = estimateReadingTime(post.content)
  const primaryTag = post.tags[0]
  const tagLabel = primaryTag
    ? (JOURNAL_TAGS.find((t) => t.slug === primaryTag)?.label ??
      primaryTag.replace(/-/g, ' '))
    : null

  return (
    <section className="mt-10 grid gap-8 rounded-xl border border-border-subtle bg-bg-surface p-6 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-12 md:p-10">
      <div className="flex flex-col gap-4">
        {tagLabel && (
          <TagPill>{tagLabel}</TagPill>
        )}
        <h2 className="font-fraunces text-[2rem] leading-tight text-text-primary md:text-[2.25rem]">
          <Link
            href={`/journal/${post.slug}`}
            className="no-underline hover:text-brand-text"
          >
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="font-source-serif-4 text-base leading-relaxed text-text-secondary line-clamp-3">
            {post.excerpt}
          </p>
        )}
        <p className="font-dm-mono text-xs text-text-tertiary">
          {minutes} min read
        </p>
        <div>
          <Link
            href={`/journal/${post.slug}`}
            className="inline-flex items-center rounded-md bg-brand-ui px-4 py-2 font-dm-sans text-sm text-text-on-brand no-underline transition-colors hover:bg-brand-hover"
          >
            Read the article →
          </Link>
        </div>
      </div>
      <FeaturedIllustration tag={post.tags[0]} />
    </section>
  )
}

function FeaturedIllustration({ tag }: { tag?: string }) {
  return (
    <div className="flex aspect-[5/4] w-full items-center justify-center rounded-xl bg-[var(--section-cream)]">
      <svg
        viewBox="0 0 320 256"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
        role="presentation"
      >
        <defs>
          <linearGradient id="fox-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#D4622E" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {renderIllustrationBody(tag)}
      </svg>
    </div>
  )
}

function renderIllustrationBody(tag?: string) {
  switch (tag) {
    case 'reading-guides':
      return <ReadingGuidesArt />
    case 'book-picks':
      return <BookPicksArt />
    case 'author-spotlights':
      return <AuthorSpotlightsArt />
    case 'book-analysis':
      return <BookAnalysisArt />
    case 'book-clubs':
      return <BookClubsArt />
    default:
      return <DefaultArt />
  }
}

function DefaultArt() {
  return (
    <>
      <circle cx="232" cy="76" r="48" fill="url(#fox-glow)" opacity="0.55" />
      <rect
        x="36"
        y="56"
        width="200"
        height="148"
        rx="10"
        fill="#FAE0D6"
        stroke="#D4622E"
        strokeWidth="2"
      />
      <rect
        x="56"
        y="76"
        width="200"
        height="148"
        rx="10"
        fill="#FFFFFF"
        stroke="#16100B"
        strokeWidth="2"
      />
      <line x1="80" y1="108" x2="220" y2="108" stroke="#D4622E" strokeWidth="3" strokeLinecap="round" />
      <line x1="80" y1="132" x2="200" y2="132" stroke="#815E41" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="80" y1="152" x2="216" y2="152" stroke="#815E41" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="80" y1="172" x2="188" y2="172" stroke="#815E41" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="80" y1="192" x2="208" y2="192" stroke="#815E41" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </>
  )
}

function ReadingGuidesArt() {
  // Open book in the foreground, candle on the right casting an amber
  // glow circle. Page rules in charcoal hatching, single warm-brown rule
  // at the top of each page for a header.
  return (
    <>
      <circle cx="248" cy="76" r="44" fill="url(#fox-glow)" opacity="0.6" />
      {/* candle */}
      <rect x="240" y="80" width="16" height="80" fill="#FAE0D6" stroke="#16100B" strokeWidth="2" />
      <rect x="240" y="80" width="16" height="8" fill="#D4622E" stroke="#16100B" strokeWidth="2" />
      <path d="M248 56 C242 64 242 72 248 80 C254 72 254 64 248 56 Z" fill="#F5A623" stroke="#16100B" strokeWidth="2" />
      <line x1="248" y1="160" x2="248" y2="200" stroke="#815E41" strokeWidth="2" />
      <ellipse cx="248" cy="202" rx="20" ry="4" fill="#FAE0D6" stroke="#16100B" strokeWidth="2" />
      {/* open book */}
      <path d="M40 156 L40 84 L156 96 L156 168 Z" fill="#FFFFFF" stroke="#16100B" strokeWidth="2" />
      <path d="M156 168 L156 96 L224 84 L224 156 Z" fill="#FFFFFF" stroke="#16100B" strokeWidth="2" />
      <line x1="156" y1="96" x2="156" y2="168" stroke="#16100B" strokeWidth="2" />
      {/* page header rules */}
      <line x1="56" y1="108" x2="140" y2="116" stroke="#D4622E" strokeWidth="2" strokeLinecap="round" />
      <line x1="172" y1="116" x2="208" y2="108" stroke="#D4622E" strokeWidth="2" strokeLinecap="round" />
      {/* page body rules */}
      <line x1="56" y1="124" x2="140" y2="130" stroke="#815E41" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="56" y1="136" x2="136" y2="142" stroke="#815E41" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="56" y1="148" x2="140" y2="153" stroke="#815E41" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="172" y1="130" x2="208" y2="124" stroke="#815E41" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="172" y1="142" x2="204" y2="136" stroke="#815E41" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="172" y1="153" x2="208" y2="148" stroke="#815E41" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* table */}
      <line x1="20" y1="208" x2="300" y2="208" stroke="#16100B" strokeWidth="2" />
    </>
  )
}

function BookPicksArt() {
  // A stack of four books with a fox silhouette on top. Amber accent on
  // the second spine from the top.
  return (
    <>
      <circle cx="232" cy="88" r="48" fill="url(#fox-glow)" opacity="0.55" />
      {/* stack */}
      <rect x="60" y="180" width="200" height="24" rx="2" fill="#FAE0D6" stroke="#16100B" strokeWidth="2" />
      <rect x="72" y="156" width="184" height="24" rx="2" fill="#D4622E" stroke="#16100B" strokeWidth="2" transform="rotate(-2 164 168)" />
      <rect x="64" y="132" width="192" height="24" rx="2" fill="#FFFFFF" stroke="#16100B" strokeWidth="2" transform="rotate(1 160 144)" />
      <rect x="80" y="108" width="168" height="24" rx="2" fill="#815E41" stroke="#16100B" strokeWidth="2" transform="rotate(-1 164 120)" />
      {/* spine bands */}
      <line x1="64" y1="192" x2="256" y2="192" stroke="#16100B" strokeWidth="1.5" opacity="0.5" />
      <line x1="76" y1="170" x2="252" y2="170" stroke="#16100B" strokeWidth="1.5" opacity="0.5" />
      <line x1="68" y1="144" x2="252" y2="144" stroke="#16100B" strokeWidth="1.5" opacity="0.5" />
      <line x1="84" y1="120" x2="244" y2="120" stroke="#FAE0D6" strokeWidth="1.5" opacity="0.6" />
      {/* fox silhouette on top */}
      <path
        d="M160 80 L150 92 L146 88 L150 100 L170 100 L174 88 L170 92 Z"
        fill="#16100B"
      />
      <circle cx="156" cy="94" r="1.5" fill="#FFFFFF" />
      <circle cx="164" cy="94" r="1.5" fill="#FFFFFF" />
      {/* tail */}
      <path
        d="M174 100 C188 96 192 84 188 76"
        fill="none"
        stroke="#16100B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line x1="20" y1="208" x2="300" y2="208" stroke="#16100B" strokeWidth="2" />
    </>
  )
}

function AuthorSpotlightsArt() {
  // Quill angled across the frame, inkwell at base, scroll behind. Amber
  // ink droplet near the nib.
  return (
    <>
      <circle cx="232" cy="84" r="44" fill="url(#fox-glow)" opacity="0.55" />
      {/* scroll behind */}
      <path
        d="M40 92 Q60 80 80 92 L80 188 Q60 200 40 188 Z"
        fill="#FAE0D6"
        stroke="#16100B"
        strokeWidth="2"
      />
      <path
        d="M80 92 L220 92 L220 188 L80 188 Z"
        fill="#FFFFFF"
        stroke="#16100B"
        strokeWidth="2"
      />
      <path
        d="M220 92 Q240 80 260 92 L260 188 Q240 200 220 188 Z"
        fill="#FAE0D6"
        stroke="#16100B"
        strokeWidth="2"
      />
      {/* scroll text hatching */}
      <line x1="96" y1="112" x2="200" y2="112" stroke="#815E41" strokeWidth="1.5" opacity="0.5" />
      <line x1="96" y1="124" x2="192" y2="124" stroke="#815E41" strokeWidth="1.5" opacity="0.5" />
      <line x1="96" y1="136" x2="196" y2="136" stroke="#815E41" strokeWidth="1.5" opacity="0.5" />
      <line x1="96" y1="148" x2="184" y2="148" stroke="#815E41" strokeWidth="1.5" opacity="0.5" />
      {/* inkwell */}
      <rect x="200" y="172" width="40" height="32" rx="3" fill="#16100B" stroke="#16100B" strokeWidth="2" />
      <ellipse cx="220" cy="172" rx="20" ry="5" fill="#D4622E" stroke="#16100B" strokeWidth="2" />
      {/* quill */}
      <path
        d="M84 198 L228 70"
        stroke="#16100B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M228 70 L248 44 L264 64 L240 84 Z"
        fill="#FFFFFF"
        stroke="#16100B"
        strokeWidth="2"
      />
      {/* feather barbs */}
      <line x1="234" y1="62" x2="248" y2="56" stroke="#16100B" strokeWidth="1.5" />
      <line x1="240" y1="68" x2="254" y2="62" stroke="#16100B" strokeWidth="1.5" />
      <line x1="246" y1="74" x2="260" y2="68" stroke="#16100B" strokeWidth="1.5" />
      {/* ink droplet */}
      <path
        d="M84 198 C80 204 80 212 84 216 C88 212 88 204 84 198 Z"
        fill="#F5A623"
        stroke="#16100B"
        strokeWidth="1.5"
      />
      <line x1="20" y1="220" x2="300" y2="220" stroke="#16100B" strokeWidth="2" />
    </>
  )
}

function BookAnalysisArt() {
  // Open book underneath, magnifying glass centered with amber rim.
  // Hatched text on the page, sharper text visible through the lens.
  return (
    <>
      <circle cx="200" cy="120" r="64" fill="url(#fox-glow)" opacity="0.45" />
      {/* open book */}
      <path d="M40 192 L40 92 L160 104 L160 200 Z" fill="#FFFFFF" stroke="#16100B" strokeWidth="2" />
      <path d="M160 200 L160 104 L280 92 L280 192 Z" fill="#FFFFFF" stroke="#16100B" strokeWidth="2" />
      <line x1="160" y1="104" x2="160" y2="200" stroke="#16100B" strokeWidth="2" />
      {/* faint page text */}
      <line x1="56" y1="120" x2="144" y2="128" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="56" y1="136" x2="140" y2="144" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="56" y1="152" x2="144" y2="160" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="56" y1="168" x2="138" y2="176" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="176" y1="128" x2="264" y2="120" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="176" y1="144" x2="260" y2="136" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="176" y1="160" x2="264" y2="152" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      <line x1="176" y1="176" x2="258" y2="168" stroke="#815E41" strokeWidth="1.5" opacity="0.4" />
      {/* magnifying glass */}
      <circle cx="200" cy="120" r="48" fill="#FAF6EE" stroke="#D4622E" strokeWidth="6" opacity="0.95" />
      <circle cx="200" cy="120" r="48" fill="none" stroke="#16100B" strokeWidth="2" />
      {/* sharper text inside lens */}
      <line x1="172" y1="108" x2="228" y2="108" stroke="#16100B" strokeWidth="2" />
      <line x1="172" y1="120" x2="224" y2="120" stroke="#16100B" strokeWidth="2" />
      <line x1="172" y1="132" x2="220" y2="132" stroke="#16100B" strokeWidth="2" />
      {/* handle */}
      <line x1="234" y1="154" x2="276" y2="196" stroke="#16100B" strokeWidth="8" strokeLinecap="round" />
      <line x1="234" y1="154" x2="276" y2="196" stroke="#815E41" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="220" x2="300" y2="220" stroke="#16100B" strokeWidth="2" />
    </>
  )
}

function BookClubsArt() {
  // Two simple armchairs facing inward, a small table with an open book
  // between, an amber lamp glow above.
  return (
    <>
      <circle cx="160" cy="48" r="36" fill="url(#fox-glow)" opacity="0.6" />
      {/* lamp pendant */}
      <line x1="160" y1="0" x2="160" y2="36" stroke="#16100B" strokeWidth="2" />
      <path d="M144 36 L176 36 L172 56 L148 56 Z" fill="#F5A623" stroke="#16100B" strokeWidth="2" />
      {/* left chair */}
      <path
        d="M40 200 L40 120 Q40 104 56 104 L96 104 Q112 104 112 120 L112 200 Z"
        fill="#FAE0D6"
        stroke="#16100B"
        strokeWidth="2"
      />
      <path
        d="M40 144 L24 144 L24 192 L40 192"
        fill="#FAE0D6"
        stroke="#16100B"
        strokeWidth="2"
      />
      <line x1="40" y1="200" x2="40" y2="216" stroke="#16100B" strokeWidth="3" />
      <line x1="112" y1="200" x2="112" y2="216" stroke="#16100B" strokeWidth="3" />
      <line x1="56" y1="140" x2="96" y2="140" stroke="#815E41" strokeWidth="1.5" opacity="0.6" />
      {/* right chair */}
      <path
        d="M208 200 L208 120 Q208 104 224 104 L264 104 Q280 104 280 120 L280 200 Z"
        fill="#FAE0D6"
        stroke="#16100B"
        strokeWidth="2"
      />
      <path
        d="M280 144 L296 144 L296 192 L280 192"
        fill="#FAE0D6"
        stroke="#16100B"
        strokeWidth="2"
      />
      <line x1="208" y1="200" x2="208" y2="216" stroke="#16100B" strokeWidth="3" />
      <line x1="280" y1="200" x2="280" y2="216" stroke="#16100B" strokeWidth="3" />
      <line x1="224" y1="140" x2="264" y2="140" stroke="#815E41" strokeWidth="1.5" opacity="0.6" />
      {/* table between */}
      <rect x="124" y="184" width="72" height="6" fill="#815E41" stroke="#16100B" strokeWidth="2" />
      <line x1="132" y1="190" x2="132" y2="208" stroke="#16100B" strokeWidth="2" />
      <line x1="188" y1="190" x2="188" y2="208" stroke="#16100B" strokeWidth="2" />
      {/* open book on table */}
      <path
        d="M130 176 L160 172 L190 176 L160 184 Z"
        fill="#FFFFFF"
        stroke="#16100B"
        strokeWidth="2"
      />
      <line x1="160" y1="172" x2="160" y2="184" stroke="#16100B" strokeWidth="1.5" />
      <line x1="138" y1="178" x2="156" y2="176" stroke="#D4622E" strokeWidth="1.5" opacity="0.7" />
      <line x1="164" y1="176" x2="182" y2="178" stroke="#D4622E" strokeWidth="1.5" opacity="0.7" />
      {/* floor */}
      <line x1="20" y1="216" x2="300" y2="216" stroke="#16100B" strokeWidth="2" />
    </>
  )
}

function CategorySection({
  tag,
  posts,
}: {
  tag: (typeof JOURNAL_TAGS)[number]
  posts: JournalPostSummary[]
}) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <SectionEyebrow>{tag.label}</SectionEyebrow>
          <p className="font-source-serif-4 text-sm text-text-secondary">
            {tag.description}
          </p>
        </div>
        <Link
          href={`/journal/tag/${tag.slug}`}
          className="shrink-0 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-text-tertiary no-underline transition-colors hover:text-text-primary"
        >
          See all →
        </Link>
      </div>
      <PostCardGrid posts={posts} />
    </section>
  )
}

function LatestSection({ posts }: { posts: JournalPostSummary[] }) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <SectionEyebrow>Latest</SectionEyebrow>
        <Link
          href="/journal/archive"
          className="shrink-0 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-text-tertiary no-underline transition-colors hover:text-text-primary"
        >
          All articles →
        </Link>
      </div>
      <PostCardGrid posts={posts} />
    </section>
  )
}

function PostCardGrid({ posts }: { posts: JournalPostSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function PostCard({ post }: { post: JournalPostSummary }) {
  const primaryTag = post.tags[0]
  const tagLabel = primaryTag
    ? (JOURNAL_TAGS.find((t) => t.slug === primaryTag)?.label ??
      primaryTag.replace(/-/g, ' '))
    : null
  const minutes = post.reading_time_minutes ?? null
  return (
    <Card
      variant="content"
      href={`/journal/${post.slug}`}
      className="p-5 gap-2"
    >
      {tagLabel && <CardLabel>{tagLabel}</CardLabel>}
      <CardTitle className="line-clamp-2">{post.title}</CardTitle>
      {post.excerpt && (
        <CardBody className="flex-1 line-clamp-3">{post.excerpt}</CardBody>
      )}
      {minutes && minutes > 0 && (
        <CardMeta className="mt-1">{minutes} min read</CardMeta>
      )}
    </Card>
  )
}
