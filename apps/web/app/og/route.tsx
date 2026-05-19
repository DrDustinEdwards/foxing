/* eslint-disable @next/next/no-img-element --
 * next/og's ImageResponse uses Satori, which cannot render <Image /> from
 * next/image. Raw <img> tags are the correct and only option inside this
 * file. Suppress the rule globally for this route.
 */
import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'

const WIDTH = 1200
const HEIGHT = 630

const CREAM = '#FAF6EE'
const AMBER = '#E8B554'
const CHARCOAL = '#16100B'
const AUBURN = '#D4622E'
const AUBURN_DEEP = '#8A3610'
const TEXT_TERTIARY = '#815E41'

interface BookData {
  title: string
  author: string
  cover_url: string | null
}

interface ProfileData {
  display_name: string
  username: string
  reading_personality: string | null
  avatar_url: string | null
}

interface JournalData {
  title: string
  excerpt: string | null
  cover_image_url: string | null
}

async function loadBook(opts: {
  id?: string | null
  slug?: string | null
}): Promise<BookData | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return null
  if (!opts.slug && !opts.id) return null
  const admin = createAdminClient()
  const query = admin.from('books').select('title, author, cover_url')
  const { data } = opts.slug
    ? await query.eq('slug', opts.slug).maybeSingle()
    : await query.eq('id', opts.id!).maybeSingle()
  return (data as BookData | null) ?? null
}

async function loadProfile(username: string): Promise<ProfileData | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('display_name, username, reading_personality, avatar_url, is_public')
    .eq('username', username)
    .maybeSingle()
  const row = data as (ProfileData & { is_public: boolean }) | null
  if (!row || !row.is_public) return null
  return {
    display_name: row.display_name,
    username: row.username,
    reading_personality: row.reading_personality,
    avatar_url: row.avatar_url,
  }
}

async function loadJournal(slug: string): Promise<JournalData | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('journal_posts')
    .select('title, excerpt, cover_image_url')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  return (data as JournalData | null) ?? null
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const params = url.searchParams
  const type = params.get('type') ?? 'default'

  // For each type, prefer params that arrive inline (no DB roundtrip on the
  // edge). Fall back to id/username/slug lookups when only the identifier
  // was given. This matches lib/metadata's URL builders, which always pass
  // the full payload for cached-friendly OG generation.
  if (type === 'book') {
    const inlineTitle = params.get('title')
    const inlineAuthor = params.get('author')
    const cover = params.get('cover')
    if (inlineTitle && inlineAuthor) {
      return bookOG({ title: inlineTitle, author: inlineAuthor, cover_url: cover })
    }
    const slug = params.get('slug')
    const id = params.get('id')
    if (!slug && !id) return defaultOG()
    const book = await loadBook({ slug, id })
    if (!book) return defaultOG()
    return bookOG(book)
  }

  if (type === 'profile') {
    const inlineName = params.get('name')
    const inlinePersonality = params.get('personality')
    if (inlineName) {
      return profileOG({
        display_name: inlineName,
        username: params.get('username') ?? inlineName,
        reading_personality: inlinePersonality,
        avatar_url: params.get('avatar'),
      })
    }
    const username = params.get('username')
    if (!username) return defaultOG()
    const profile = await loadProfile(username)
    if (!profile) return defaultOG()
    return profileOG(profile)
  }

  if (type === 'journal') {
    const inlineTitle = params.get('title')
    const inlineExcerpt = params.get('excerpt')
    const inlineCover = params.get('cover')
    if (inlineTitle) {
      return journalOG({
        title: inlineTitle,
        excerpt: inlineExcerpt,
        cover_image_url: inlineCover,
      })
    }
    const slug = params.get('slug')
    if (!slug) return defaultOG()
    const post = await loadJournal(slug)
    if (!post) return defaultOG()
    return journalOG(post)
  }

  if (type === 'book-of-month') {
    return bookOfMonthOG({
      title: params.get('title') ?? '',
      author: params.get('author') ?? '',
      cover_url: params.get('cover'),
      month: params.get('month') ?? '',
      year: params.get('year') ?? '',
    })
  }

  if (type === 'diary') {
    return diaryOG({
      name: params.get('name') ?? 'A reader',
      title: params.get('title') ?? '',
      author: params.get('author') ?? '',
      cover_url: params.get('cover'),
      rating: params.get('rating'),
    })
  }

  if (type === 'list') {
    return listOG({
      title: params.get('title') ?? '',
      creator: params.get('creator') ?? '',
      count: params.get('count') ?? '',
      covers: params.getAll('cover'),
    })
  }

  if (type === 'club') {
    return clubOG({
      name: params.get('name') ?? '',
      members: params.get('members') ?? '',
      book_title: params.get('title') ?? '',
      book_cover: params.get('cover'),
    })
  }

  if (type === 'quote') {
    return quoteOG({
      text: params.get('text') ?? '',
      title: params.get('title') ?? '',
      author: params.get('author') ?? '',
    })
  }

  return defaultOG()
}

function FoxingMark({ tint = AUBURN }: { tint?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 36,
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width="32" height="32" rx="7" fill={tint} />
        <path d="M5 9 L11 5 L11.5 13 Z" fill={tint} />
        <path d="M7 9.4 L10.2 7 L10.5 11.5 Z" fill={AMBER} />
        <path d="M27 9 L21 5 L20.5 13 Z" fill={tint} />
        <path d="M25 9.4 L21.8 7 L21.5 11.5 Z" fill={AMBER} />
        <path
          d="M6 11 Q6 22 16 26 Q26 22 26 11 Q21 10 16 10 Q11 10 6 11 Z"
          fill={tint}
        />
        <path
          d="M11 18 Q16 23 21 18 Q21 21 16 24 Q11 21 11 18 Z"
          fill={CREAM}
          opacity="0.6"
        />
        <circle cx="12.5" cy="15.5" r="1.2" fill={CREAM} />
        <circle cx="19.5" cy="15.5" r="1.2" fill={CREAM} />
        <circle cx="16" cy="19.5" r="0.9" fill={CREAM} />
      </svg>
      <span style={{ color: tint, fontFamily: 'serif', fontWeight: 600 }}>
        Foxing
      </span>
    </div>
  )
}

function defaultOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: `linear-gradient(135deg, ${AUBURN} 0%, ${AUBURN_DEEP} 100%)`,
          color: 'white',
        }}
      >
        <FoxingMark tint="white" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 92,
              lineHeight: 1.05,
              fontFamily: 'serif',
              fontWeight: 600,
            }}
          >
            reading, together.
          </div>
          <div
            style={{
              fontSize: 28,
              color: 'rgba(255,255,255,0.85)',
              fontStyle: 'italic',
              fontFamily: 'serif',
            }}
          >
            Classics, an AI companion, a community of serious readers.
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function bookOG(book: BookData) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CREAM,
          color: CHARCOAL,
          padding: 64,
        }}
      >
        <div
          style={{
            width: 280,
            height: 420,
            background: '#E5D8BF',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 8,
            marginRight: 56,
            boxShadow: '0 16px 32px rgba(22,16,11,0.18)',
          }}
        >
          {book.cover_url && (
            <img
              src={book.cover_url}
              width={280}
              height={420}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'space-between',
          }}
        >
          <FoxingMark />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontSize: 64,
                lineHeight: 1.1,
                fontFamily: 'serif',
                fontWeight: 600,
                color: CHARCOAL,
              }}
            >
              {clamp(book.title, 64)}
            </div>
            <div
              style={{
                fontSize: 30,
                color: TEXT_TERTIARY,
                fontStyle: 'italic',
                fontFamily: 'serif',
              }}
            >
              {`by ${clamp(book.author, 60)}`}
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              color: TEXT_TERTIARY,
              fontFamily: 'sans-serif',
            }}
          >
            Read free on Foxing
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function profileOG(profile: ProfileData) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: CREAM,
          color: CHARCOAL,
          padding: 80,
          justifyContent: 'space-between',
        }}
      >
        <FoxingMark />
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div
            style={{
              width: 192,
              height: 192,
              borderRadius: 96,
              background: '#FAE0D6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: `4px solid ${AUBURN}`,
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                width={192}
                height={192}
                style={{ objectFit: 'cover' }}
                alt=""
              />
            ) : (
              <div
                style={{
                  fontSize: 80,
                  fontFamily: 'serif',
                  color: '#632507',
                  fontWeight: 600,
                }}
              >
                {profile.display_name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 60,
                lineHeight: 1.05,
                fontFamily: 'serif',
                fontWeight: 600,
              }}
            >
              {clamp(profile.display_name, 30)}
            </div>
            <div
              style={{
                fontSize: 28,
                color: TEXT_TERTIARY,
                fontFamily: 'monospace',
              }}
            >
              {`@${profile.username}`}
            </div>
            {profile.reading_personality && (
              <div
                style={{
                  fontSize: 28,
                  color: '#3E3028',
                  fontStyle: 'italic',
                  fontFamily: 'serif',
                }}
              >
                {clamp(profile.reading_personality, 70)}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            color: TEXT_TERTIARY,
            fontFamily: 'sans-serif',
          }}
        >
          Foxing reader
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function journalOG(post: JournalData) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CHARCOAL,
          color: CREAM,
        }}
      >
        {post.cover_image_url && (
          <div
            style={{
              width: 480,
              height: HEIGHT,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            <img
              src={post.cover_image_url}
              width={480}
              height={HEIGHT}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          </div>
        )}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
          }}
        >
          <FoxingMark tint={AUBURN} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                fontSize: 22,
                color: '#A28269',
                fontFamily: 'monospace',
                letterSpacing: 4,
              }}
            >
              JOURNAL
            </div>
            <div
              style={{
                fontSize: 56,
                lineHeight: 1.1,
                fontFamily: 'serif',
                fontWeight: 600,
                color: CREAM,
              }}
            >
              {clamp(post.title, 90)}
            </div>
            {post.excerpt && (
              <div
                style={{
                  fontSize: 24,
                  color: '#C4AE96',
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                }}
              >
                {clamp(post.excerpt, 140)}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#A28269',
              fontFamily: 'sans-serif',
            }}
          >
            foxing.app/journal
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function bookOfMonthOG(data: {
  title: string
  author: string
  cover_url: string | null
  month: string
  year: string
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CHARCOAL,
          color: CREAM,
        }}
      >
        <div
          style={{
            width: 420,
            height: HEIGHT,
            display: 'flex',
            background: '#2A1A0E',
            overflow: 'hidden',
          }}
        >
          {data.cover_url && (
            <img
              src={data.cover_url}
              width={420}
              height={HEIGHT}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span
              style={{
                alignSelf: 'flex-start',
                padding: '6px 16px',
                borderRadius: 999,
                background: AUBURN,
                color: 'white',
                fontFamily: 'monospace',
                fontSize: 18,
                letterSpacing: 2,
              }}
            >
              BOOK OF THE MONTH
            </span>
            <span
              style={{
                color: '#C4AE96',
                fontFamily: 'monospace',
                fontSize: 22,
                letterSpacing: 4,
              }}
            >
              {`${data.month.toUpperCase()} ${data.year}`}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                fontSize: 60,
                lineHeight: 1.05,
                fontFamily: 'serif',
                fontWeight: 600,
                color: CREAM,
              }}
            >
              {clamp(data.title, 80)}
            </div>
            <div
              style={{
                fontSize: 28,
                color: '#C4AE96',
                fontStyle: 'italic',
                fontFamily: 'serif',
              }}
            >
              {`by ${clamp(data.author, 50)}`}
            </div>
          </div>
          <FoxingMark tint={AUBURN} />
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function diaryOG(data: {
  name: string
  title: string
  author: string
  cover_url: string | null
  rating: string | null
}) {
  const stars = data.rating ? Math.max(0, Math.min(5, Number(data.rating))) : 0
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CREAM,
          color: CHARCOAL,
          padding: 64,
        }}
      >
        <div
          style={{
            width: 240,
            height: 360,
            background: '#E5D8BF',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 8,
            marginRight: 48,
            boxShadow: '0 16px 32px rgba(22,16,11,0.18)',
          }}
        >
          {data.cover_url && (
            <img
              src={data.cover_url}
              width={240}
              height={360}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <FoxingMark />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 22,
                color: TEXT_TERTIARY,
                letterSpacing: 3,
              }}
            >
              READ
            </span>
            <div
              style={{
                fontSize: 48,
                fontFamily: 'serif',
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              {clamp(`${data.name} on ${data.title}`, 70)}
            </div>
            <div
              style={{
                fontSize: 24,
                color: TEXT_TERTIARY,
                fontStyle: 'italic',
                fontFamily: 'serif',
              }}
            >
              {`by ${clamp(data.author, 50)}`}
            </div>
            {data.rating && stars > 0 && (
              <div
                style={{
                  fontSize: 40,
                  letterSpacing: 6,
                  color: AUBURN,
                }}
              >
                {'★'.repeat(Math.round(stars))}
                <span style={{ color: '#D6C3A3' }}>
                  {'★'.repeat(Math.max(0, 5 - Math.round(stars)))}
                </span>
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 22,
              color: TEXT_TERTIARY,
              fontFamily: 'sans-serif',
            }}
          >
            foxing.app
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function listOG(data: {
  title: string
  creator: string
  count: string
  covers: string[]
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CHARCOAL,
          color: CREAM,
          padding: 80,
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {data.covers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              opacity: 0.18,
              filter: 'blur(8px)',
            }}
          >
            {data.covers.slice(0, 3).map((url, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={url}
                  width={400}
                  height={HEIGHT}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  alt=""
                />
              </div>
            ))}
          </div>
        )}
        <FoxingMark tint={AUBURN} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 22,
              color: '#C4AE96',
              letterSpacing: 4,
            }}
          >
            LIST
          </span>
          <div
            style={{
              fontSize: 84,
              fontFamily: 'serif',
              fontWeight: 600,
              lineHeight: 1.05,
            }}
          >
            {clamp(data.title, 60)}
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#C4AE96',
              fontStyle: 'italic',
              fontFamily: 'serif',
            }}
          >
            {data.creator && `by ${clamp(data.creator, 40)} · `}
            {data.count && `${data.count} books`}
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#A28269',
            fontFamily: 'sans-serif',
          }}
        >
          foxing.app/lists
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function clubOG(data: {
  name: string
  members: string
  book_title: string
  book_cover: string | null
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CREAM,
          color: CHARCOAL,
          padding: 64,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <FoxingMark />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 22,
                color: TEXT_TERTIARY,
                letterSpacing: 4,
              }}
            >
              READING CLUB
            </span>
            <div
              style={{
                fontSize: 72,
                fontFamily: 'serif',
                fontWeight: 600,
                lineHeight: 1.05,
              }}
            >
              {clamp(data.name, 40)}
            </div>
            {data.members && (
              <div
                style={{
                  fontSize: 28,
                  color: TEXT_TERTIARY,
                  fontFamily: 'sans-serif',
                }}
              >
                {`${data.members} members`}
              </div>
            )}
            {data.book_title && (
              <div
                style={{
                  fontSize: 26,
                  color: '#3E3028',
                  fontStyle: 'italic',
                  fontFamily: 'serif',
                }}
              >
                {`Reading ${clamp(data.book_title, 50)}`}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 22,
              color: TEXT_TERTIARY,
              fontFamily: 'sans-serif',
            }}
          >
            foxing.app/clubs
          </div>
        </div>
        {data.book_cover && (
          <div
            style={{
              width: 280,
              height: 420,
              alignSelf: 'center',
              marginLeft: 48,
              display: 'flex',
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 16px 32px rgba(22,16,11,0.18)',
              background: '#E5D8BF',
            }}
          >
            <img
              src={data.book_cover}
              width={280}
              height={420}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          </div>
        )}
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function quoteOG(data: {
  text: string
  title: string
  author: string
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: CHARCOAL,
          color: CREAM,
          padding: 96,
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: 80,
            color: AUBURN,
            fontFamily: 'serif',
            lineHeight: 1,
          }}
        >
          “
        </div>
        <div
          style={{
            fontSize: 44,
            fontFamily: 'serif',
            fontStyle: 'italic',
            lineHeight: 1.25,
            color: CREAM,
            textAlign: 'center',
            padding: '0 32px',
            display: 'flex',
          }}
        >
          {clamp(data.text, 220)}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontSize: 24,
                color: '#C4AE96',
                fontFamily: 'serif',
                fontStyle: 'italic',
              }}
            >
              {data.title && `from ${clamp(data.title, 40)}`}
            </span>
            <span
              style={{
                fontSize: 22,
                color: '#A28269',
                fontFamily: 'sans-serif',
              }}
            >
              {data.author && `by ${clamp(data.author, 40)}`}
            </span>
          </div>
          <FoxingMark tint={AUBURN} />
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max).trimEnd()}...`
}
