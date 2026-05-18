import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { resolveAffiliateLinks, type AffiliateBook } from '@/lib/affiliate'
import { appBookDeeplink } from '@/lib/foxing'

interface Props {
  book: AffiliateBook & {
    id: string
    source_type?: 'catalog' | 'community' | null
    epub_url?: string | null
  }
  variant?: 'panel' | 'inline'
  amazon_url_override?: string | null
  bookshop_url_override?: string | null
}

const REL_AFFILIATE = 'sponsored noopener noreferrer'

/**
 * Bookshop.org is always listed before Amazon. Affiliate links carry
 * rel="sponsored" per FTC guidance and Google search standards.
 */
export function WhereToRead({
  book,
  variant = 'panel',
  amazon_url_override,
  bookshop_url_override,
}: Props) {
  const isCommunity = book.source_type === 'community' || !book.epub_url
  const links = resolveAffiliateLinks({
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    isbn13: book.isbn13,
    amazon_url: amazon_url_override ?? book.amazon_url ?? null,
    bookshop_url: bookshop_url_override ?? book.bookshop_url ?? null,
  })

  if (variant === 'inline') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <a
            href={links.bookshop}
            target="_blank"
            rel={REL_AFFILIATE}
          >
            <Button variant="primary" size="md">
              Buy from Bookshop.org
            </Button>
          </a>
          <a
            href={links.amazon}
            target="_blank"
            rel={REL_AFFILIATE}
          >
            <Button variant="secondary" size="md">
              Buy on Amazon
            </Button>
          </a>
          <a
            href={links.worldcat}
            target="_blank"
            rel="noopener noreferrer"
            className="self-center font-dm-sans text-sm text-brand-text hover:underline"
          >
            Find in a library
          </a>
        </div>
        <p className="font-dm-sans text-xs text-text-tertiary">
          Bookshop supports independent bookstores. We earn a small commission
          on links, at no extra cost to you.
        </p>
      </div>
    )
  }

  if (isCommunity) {
    return (
      <section className="border-t border-border-subtle py-6">
        <h2 className="mb-4 font-fraunces text-xl text-text-primary">
          Where to read {book.title}
        </h2>
        <div className="flex flex-col gap-3">
          <a
            href={links.bookshop}
            target="_blank"
            rel={REL_AFFILIATE}
            className="block"
          >
            <Button variant="primary" size="md" fullWidth>
              Buy from Bookshop.org
            </Button>
          </a>
          <p className="font-dm-sans text-xs text-text-tertiary">
            Bookshop supports independent bookstores.
          </p>
          <a
            href={links.amazon}
            target="_blank"
            rel={REL_AFFILIATE}
            className="block"
          >
            <Button variant="secondary" size="md" fullWidth>
              Buy on Amazon
            </Button>
          </a>
          <a
            href={links.worldcat}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Find in a library
          </a>
          <a
            href={links.ebookSearch}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Check Kindle, Kobo, or Apple Books
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="border-t border-border-subtle py-6">
      <h2 className="mb-4 font-fraunces text-xl text-text-primary">
        Where to read this
      </h2>
      <ul className="flex flex-col gap-2">
        {book.epub_url && (
          <li>
            <Link
              href={appBookDeeplink(book.id)}
              className="font-dm-sans text-sm text-brand-text hover:underline"
            >
              Read free in Foxing
            </Link>
          </li>
        )}
        <li>
          <a
            href={links.bookshop}
            target="_blank"
            rel={REL_AFFILIATE}
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Buy from Bookshop.org
          </a>
        </li>
        <li>
          <a
            href={links.amazon}
            target="_blank"
            rel={REL_AFFILIATE}
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Buy on Amazon
          </a>
        </li>
        <li>
          <a
            href={links.worldcat}
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            Find in a library
          </a>
        </li>
      </ul>
    </section>
  )
}
