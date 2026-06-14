import { BookCard, type BookCardBook } from '@/components/book-card'
import { ClubCard } from '@/components/club-card'
import { UserCard } from '@/components/user-card'
import type { SearchHit } from '@/lib/search/types'
import {
  AuthorCard,
  JournalCard,
  ListCard,
  PickCard,
  QuoteCard,
} from './cards/entity-cards'

/**
 * The ONE result renderer: entity -> card. Reuses the existing
 * BookCard / UserCard / ClubCard and the stub cards for the rest. Both the
 * /search page and the command palette render hits through this.
 */
export function SearchResultItem({ hit }: { hit: SearchHit }) {
  switch (hit.entity) {
    case 'book': {
      const b = hit.data as Record<string, unknown>
      const book: BookCardBook = {
        id: String(b.id),
        slug: (b.slug as string | null) ?? null,
        title: String(b.title),
        author: String(b.author ?? ''),
        cover_url: (b.cover_url as string | null) ?? null,
        themes: (b.themes as string[] | null) ?? null,
        weighted_rating: (b.weighted_rating as number | null) ?? null,
      }
      return <BookCard book={book} size="sm" />
    }
    case 'person': {
      const p = hit.data as Record<string, unknown>
      return (
        <UserCard
          profile={{
            username: String(p.username),
            display_name: String(p.display_name ?? p.username),
            avatar_url: (p.avatar_url as string | null) ?? null,
            reading_personality: (p.reading_personality as string | null) ?? null,
          }}
        />
      )
    }
    case 'club': {
      const c = hit.data as Record<string, unknown>
      const cb = c.current_book as Record<string, unknown> | null
      return (
        <ClubCard
          club={{
            id: String(c.id),
            name: String(c.name),
            cover_url: (c.cover_url as string | null) ?? null,
            slug: (c.slug as string | null) ?? null,
          }}
          currentBook={
            cb
              ? { title: String(cb.title), cover_url: (cb.cover_url as string | null) ?? null }
              : null
          }
          memberCount={(c.member_count as number | undefined) ?? 0}
        />
      )
    }
    case 'author':
      return <AuthorCard hit={hit as SearchHit<'author'>} />
    case 'list':
      return <ListCard hit={hit as SearchHit<'list'>} />
    case 'quote':
      return <QuoteCard hit={hit as SearchHit<'quote'>} />
    case 'journal':
      return <JournalCard hit={hit as SearchHit<'journal'>} />
    case 'pick':
      return <PickCard hit={hit as SearchHit<'pick'>} />
    default:
      return null
  }
}
