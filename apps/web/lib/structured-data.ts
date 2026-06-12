import { siteOrigin } from '@/lib/foxing'

/**
 * Serialize a JSON-LD object for injection into a <script type="application/ld+json">
 * via dangerouslySetInnerHTML. Escapes `<` so a user-controlled value containing
 * `</script>` cannot break out of the element (stored XSS). Use this everywhere a
 * JSON-LD blob is injected; never raw JSON.stringify.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

interface BookLike {
  id: string
  title: string
  author: string
  description?: string | null
  cover_url?: string | null
  gutenberg_id?: number | null
}

interface ProfileLike {
  username: string
  display_name: string
  avatar_url?: string | null
  reading_personality?: string | null
  bio?: string | null
}

export function bookJsonLd(book: BookLike): string {
  const origin = siteOrigin()
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    description: book.description ?? undefined,
    image: book.cover_url ?? undefined,
    url: `${origin}/book/${book.id}`,
    bookFormat: 'EBook',
    inLanguage: 'en',
  }
  return safeJsonLd(data)
}

export function profileJsonLd(profile: ProfileLike): string {
  const origin = siteOrigin()
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name,
    alternateName: profile.username,
    description: profile.reading_personality ?? profile.bio ?? undefined,
    image: profile.avatar_url ?? undefined,
    url: `${origin}/u/${profile.username}`,
  }
  return safeJsonLd(data)
}
