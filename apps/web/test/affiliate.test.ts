import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  amazonUrl,
  bookshopUrl,
  resolveAffiliateLinks,
} from '@/lib/affiliate'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('amazonUrl', () => {
  it('returns null without an isbn', () => {
    expect(amazonUrl(null)).toBeNull()
    expect(amazonUrl('')).toBeNull()
  })

  it('strips formatting from the isbn and appends the tag when set', () => {
    vi.stubEnv('NEXT_PUBLIC_AMAZON_AFFILIATE_TAG', 'foxing-20')
    expect(amazonUrl('0-14-143951-3')).toBe(
      'https://www.amazon.com/dp/0141439513?tag=foxing-20',
    )
  })

  it('omits the tag query when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_AMAZON_AFFILIATE_TAG', '')
    expect(amazonUrl('0141439513')).toBe(
      'https://www.amazon.com/dp/0141439513',
    )
  })
})

describe('bookshopUrl', () => {
  it('builds the affiliate path when the id is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID', '99999')
    expect(bookshopUrl('978-0-14-143951-8')).toBe(
      'https://bookshop.org/a/99999/9780141439518',
    )
  })

  it('falls back to the plain isbn URL when no affiliate id', () => {
    vi.stubEnv('NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID', '')
    expect(bookshopUrl('9780141439518')).toBe(
      'https://bookshop.org/isbn/9780141439518',
    )
  })

  it('returns the row fallback only when there is no isbn', () => {
    expect(bookshopUrl(null, 'https://bookshop.org/p/custom')).toBe(
      'https://bookshop.org/p/custom',
    )
    expect(bookshopUrl(null, null)).toBeNull()
  })
})

describe('resolveAffiliateLinks', () => {
  const book = { title: 'Persuasion', author: 'Jane Austen' }

  it('isbn-based affiliate URLs beat per-row overrides so the tag is credited', () => {
    vi.stubEnv('NEXT_PUBLIC_BOOKSHOP_AFFILIATE_ID', '99999')
    vi.stubEnv('NEXT_PUBLIC_AMAZON_AFFILIATE_TAG', 'foxing-20')
    const links = resolveAffiliateLinks({
      ...book,
      isbn: '0141439688',
      isbn13: '9780141439686',
      amazon_url: 'https://www.amazon.com/dp/override',
      bookshop_url: 'https://bookshop.org/p/override',
    })
    expect(links.bookshop).toBe('https://bookshop.org/a/99999/9780141439686')
    expect(links.amazon).toBe(
      'https://www.amazon.com/dp/0141439688?tag=foxing-20',
    )
    expect(links.hasIsbn).toBe(true)
  })

  it('falls back to search URLs when nothing is stored', () => {
    const links = resolveAffiliateLinks(book)
    expect(links.bookshop).toContain('bookshop.org/search?keywords=')
    expect(links.amazon).toContain('amazon.com/s?')
    expect(links.worldcat).toContain('worldcat.org/search?q=')
    expect(links.hasIsbn).toBe(false)
  })

  it('always returns all four channels', () => {
    const links = resolveAffiliateLinks(book)
    for (const url of [
      links.bookshop,
      links.amazon,
      links.worldcat,
      links.ebookSearch,
    ]) {
      expect(url).toMatch(/^https:\/\//)
    }
  })
})
