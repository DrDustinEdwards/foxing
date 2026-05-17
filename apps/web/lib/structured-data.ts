import { siteOrigin } from '@/lib/foxing'

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
  return JSON.stringify(data)
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
  return JSON.stringify(data)
}
