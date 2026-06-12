import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'

interface HighlightCardProps {
  text: string
  book: { title: string; author: string; id: string; slug?: string | null }
  author?: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export function HighlightCard({ text, book, author }: HighlightCardProps) {
  const bookHref = `/book/${book.slug ?? book.id}`
  return (
    <figure className="flex flex-col gap-3 rounded-lg border-l-[3px] border-brand-ui bg-bg-surface p-4 shadow-sm">
      <blockquote className="font-source-serif-4 text-[0.9375rem] italic text-text-primary">
        {text}
      </blockquote>
      <Link
        href={bookHref}
        className="font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
      >
        <span className="font-medium text-text-secondary">{book.title}</span>
        <span> · {book.author}</span>
      </Link>
      {author && (
        <figcaption className="flex items-center gap-2 border-t border-border-subtle pt-3">
          <Avatar
            src={author.avatar_url}
            name={author.display_name}
            size="sm"
          />
          <Link
            href={`/u/${author.username}`}
            className="font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
          >
            @{author.username}
          </Link>
        </figcaption>
      )}
    </figure>
  )
}
