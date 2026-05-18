import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'

const WIDTH = 1200
const HEIGHT = 630

const CREAM = '#FAF6EE'
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

async function loadBook(id: string): Promise<BookData | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('books')
    .select('title, author, cover_url')
    .eq('id', id)
    .maybeSingle()
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
    const id = params.get('id')
    if (!id) return defaultOG()
    const book = await loadBook(id)
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
      <span style={{ fontSize: 44 }}>🦊</span>
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

function clamp(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max).trimEnd()}...`
}
