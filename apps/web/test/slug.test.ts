import { describe, expect, it } from 'vitest'
import { slugify, slugifySeriesName } from '@/lib/slug'

// URL rule: /author/jane-austen, never /author/Jane%20Austen. Slugs must be
// lowercase ascii with single hyphens, no leading/trailing hyphen.
describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Jane Austen')).toBe('jane-austen')
  })

  it('strips diacritics via NFKD', () => {
    expect(slugify('Émile Zola')).toBe('emile-zola')
    expect(slugify('Brontë')).toBe('bronte')
  })

  it('collapses punctuation runs into one hyphen', () => {
    expect(slugify("Alice's Adventures -- in Wonderland!")).toBe(
      'alice-s-adventures-in-wonderland',
    )
  })

  it('trims leading and trailing separators', () => {
    expect(slugify('  The Odyssey  ')).toBe('the-odyssey')
    expect(slugify('!Hamlet!')).toBe('hamlet')
  })

  it('only ever emits [a-z0-9-]', () => {
    for (const input of ['Война и мир', 'C# in Depth', '20,000 Leagues']) {
      expect(slugify(input)).toMatch(/^[a-z0-9-]*$/)
    }
  })
})

describe('slugifySeriesName', () => {
  it('drops apostrophes instead of hyphenating them', () => {
    expect(slugifySeriesName("Hercule Poirot's Cases")).toBe(
      'hercule-poirots-cases',
    )
  })

  it('lowercases, trims, and hyphenates', () => {
    expect(slugifySeriesName('  Sherlock Holmes  ')).toBe('sherlock-holmes')
  })
})
