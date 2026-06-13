import { describe, expect, it } from 'vitest'
import {
  buildBookMetadata,
  buildBookTitle,
  buildBookDescription,
  buildBooksListingMetadata,
  buildClubMetadata,
  buildThemeMetadata,
  buildProfileMetadata,
} from '@/lib/metadata'
import { truncate } from '@/lib/strings'

describe('truncate', () => {
  it('returns short strings untouched', () => {
    expect(truncate('abc', 10)).toBe('abc')
  })

  it('clamps to max including the ellipsis', () => {
    const out = truncate('a'.repeat(100), 70)
    expect(out.length).toBeLessThanOrEqual(70)
    expect(out.endsWith('...')).toBe(true)
  })
})

describe('book metadata', () => {
  it('clamps the title to 70 chars', () => {
    const title = buildBookTitle({
      title: 'T'.repeat(100),
      author: 'A'.repeat(50),
    })
    expect(title.length).toBeLessThanOrEqual(70)
  })

  it('clamps the description to 160 chars', () => {
    const description = buildBookDescription({
      title: 'X',
      author: 'Y',
      description: 'd'.repeat(500),
      themes: ['one', 'two', 'three'],
    })
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('canonical uses /book/[slug], falling back to id only without a slug', () => {
    const withSlug = buildBookMetadata({
      id: 'uuid-1',
      slug: 'persuasion',
      title: 'Persuasion',
      author: 'Jane Austen',
    })
    expect(withSlug.alternates?.canonical).toBe(
      'https://foxing.app/book/persuasion',
    )
    const withoutSlug = buildBookMetadata({
      id: 'uuid-1',
      slug: null,
      title: 'Persuasion',
      author: 'Jane Austen',
    })
    expect(withoutSlug.alternates?.canonical).toBe(
      'https://foxing.app/book/uuid-1',
    )
  })
})

describe('profile metadata', () => {
  it('canonical uses /u/[username]', () => {
    const meta = buildProfileMetadata({
      display_name: 'Dustin',
      username: 'dustin',
    })
    expect(meta.alternates?.canonical).toBe('https://foxing.app/u/dustin')
  })
})

describe('club metadata', () => {
  it('canonical uses /clubs/[slug], not the uuid, when a slug exists', () => {
    const meta = buildClubMetadata({
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'austen-society',
      name: 'Austen Society',
    })
    expect(meta.alternates?.canonical).toBe(
      'https://foxing.app/clubs/austen-society',
    )
  })
})

describe('books listing indexing rules', () => {
  it('indexes the unfiltered listing', () => {
    const meta = buildBooksListingMetadata({})
    expect(meta.robots).toMatchObject({ index: true, follow: true })
  })

  it('indexes a single-filter view', () => {
    const meta = buildBooksListingMetadata({ mood: 'dark' })
    expect(meta.robots).toMatchObject({ index: true })
  })

  it('noindexes multi-filter combinations (thin content)', () => {
    const meta = buildBooksListingMetadata({ mood: 'dark', era: '1800s' })
    expect(meta.robots).toMatchObject({ index: false, follow: true })
  })

  it('noindexes search result pages', () => {
    const meta = buildBooksListingMetadata({ search: 'whale' })
    expect(meta.robots).toMatchObject({ index: false })
  })
})

describe('theme metadata', () => {
  it('noindexes unknown theme slugs instead of throwing', () => {
    const meta = buildThemeMetadata('not-a-theme')
    expect(meta.robots).toMatchObject({ index: false })
  })
})
