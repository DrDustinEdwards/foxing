import { describe, expect, it } from 'vitest'
import {
  buildFindNextBookHref,
  mapQueryToFindNextBookParams,
} from '@/lib/search/ai-intent'

describe('mapQueryToFindNextBookParams', () => {
  it('picks up literal mood tokens', () => {
    const p = mapQueryToFindNextBookParams('something dark and mysterious')
    expect(p.mood).toContain('dark')
    expect(p.mood).toContain('mysterious')
  })

  it('maps keyword hints to moods', () => {
    expect(mapQueryToFindNextBookParams('a gothic horror novel').mood).toContain(
      'dark',
    )
    expect(mapQueryToFindNextBookParams('a funny beach read').mood).toContain(
      'funny',
    )
  })

  it('infers pace', () => {
    expect(mapQueryToFindNextBookParams('a fast page-turner').pace).toBe('fast')
    expect(mapQueryToFindNextBookParams('a slow literary novel').pace).toBe(
      'slow',
    )
    expect(mapQueryToFindNextBookParams('a good book').pace).toBe('any')
  })

  it('infers era', () => {
    expect(mapQueryToFindNextBookParams('victorian classics').era).toBe(
      'pre-1900',
    )
    expect(mapQueryToFindNextBookParams('modern fiction').era).toBe('modern')
    expect(mapQueryToFindNextBookParams('a good book').era).toBe('anytime')
  })

  it('builds a prefilled href, omitting defaults', () => {
    expect(buildFindNextBookHref('a good book')).toBe('/find-next-book')
    const href = buildFindNextBookHref('a fast dark victorian thriller')
    expect(href.startsWith('/find-next-book?')).toBe(true)
    expect(href).toContain('pace=fast')
    expect(href).toContain('era=pre-1900')
    expect(href).toContain('mood=')
  })
})
