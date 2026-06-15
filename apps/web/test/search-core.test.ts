import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { searchEntity, searchFederated } from '@/lib/search/query'
import { getAdapter } from '@/lib/search/adapters'
import {
  encodeCursor,
  decodeCursor,
  escapeLike,
  likePattern,
} from '@/lib/search/escape'
import {
  paramsToSearch,
  searchToParams,
  type FilterBarConfig,
} from '@/lib/search/filter-config'
import type {
  SearchClient,
  SearchQueryBuilder,
  SearchQueryResult,
} from '@/lib/search/types'

// ── Fake query builder (records the chain, resolves a canned result) ────────

interface Call {
  method: string
  args: unknown[]
}

class FakeBuilder implements SearchQueryBuilder {
  calls: Call[] = []
  constructor(
    table: string,
    private readonly result: SearchQueryResult,
  ) {
    this.calls.push({ method: 'from', args: [table] })
  }
  private rec(method: string, ...args: unknown[]): this {
    this.calls.push({ method, args })
    return this
  }
  select(c: string, o?: unknown) { return this.rec('select', c, o) }
  or(f: string, o?: unknown) { return this.rec('or', f, o) }
  ilike(c: string, p: string) { return this.rec('ilike', c, p) }
  contains(c: string, v: unknown) { return this.rec('contains', c, v) }
  eq(c: string, v: unknown) { return this.rec('eq', c, v) }
  gte(c: string, v: unknown) { return this.rec('gte', c, v) }
  lte(c: string, v: unknown) { return this.rec('lte', c, v) }
  order(c: string, o?: unknown) { return this.rec('order', c, o) }
  range(a: number, b: number) { return this.rec('range', a, b) }
  then<T1 = SearchQueryResult, T2 = never>(
    onfulfilled?: ((v: SearchQueryResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

class FakeClient implements SearchClient {
  fromCalls: string[] = []
  builders: FakeBuilder[] = []
  constructor(
    private readonly resultFor: (table: string) => SearchQueryResult,
  ) {}
  from(table: string): SearchQueryBuilder {
    this.fromCalls.push(table)
    const b = new FakeBuilder(table, this.resultFor(table))
    this.builders.push(b)
    return b
  }
}

function fixed(data: Record<string, unknown>[], count: number): FakeClient {
  return new FakeClient(() => ({ data, count, error: null }))
}
function lastBuilder(c: FakeClient): FakeBuilder {
  return c.builders[c.builders.length - 1]
}
function call(b: FakeBuilder, method: string): Call | undefined {
  return b.calls.find((c) => c.method === method)
}
function calls(b: FakeBuilder, method: string): Call[] {
  return b.calls.filter((c) => c.method === method)
}

const BOOK_ROW = {
  id: 'b1',
  slug: 'dracula',
  author_slug: 'bram-stoker',
  title: 'Dracula',
  author: 'Bram Stoker',
  cover_url: 'http://x/c.jpg',
  themes: ['gothic'],
  weighted_rating: 4.2,
}

// ── escape + cursor ─────────────────────────────────────────────────────────

describe('escape', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off')).toBe('50\\%\\_off')
  })
  it('strips PostgREST or() reserved chars', () => {
    expect(escapeLike('a,(b)c')).toBe('a b c')
  })
  it('wraps a like pattern', () => {
    expect(likePattern('cat')).toBe('%cat%')
  })
})

describe('cursor', () => {
  it('round-trips an offset', () => {
    expect(decodeCursor(encodeCursor(48))).toBe(48)
  })
  it('treats empty/garbage as offset 0', () => {
    expect(decodeCursor(null)).toBe(0)
    expect(decodeCursor('')).toBe(0)
    expect(decodeCursor('not-base64!!')).toBe(0)
  })
})

// ── query construction ──────────────────────────────────────────────────────

describe('searchEntity — book query construction', () => {
  it('builds table/select/text/filters/sort/range and maps rows', async () => {
    const client = fixed([BOOK_ROW], 50)
    const res = await searchEntity(client, {
      entity: 'book',
      query: 'dracula',
      sort: 'newest',
      filters: { mood: 'gothic', genre: 'horror', era: '1800s', length: 'long' },
      limit: 24,
    })
    const b = lastBuilder(client)

    expect(call(b, 'from')!.args[0]).toBe('books')
    expect(call(b, 'select')!.args[1]).toEqual({ count: 'exact' })
    expect(call(b, 'or')!.args[0]).toBe('title.ilike.%dracula%,author.ilike.%dracula%')
    const containsCols = calls(b, 'contains').map((c) => c.args[0])
    expect(containsCols).toContain('themes')
    expect(containsCols).toContain('subjects')
    expect(calls(b, 'gte')).toContainEqual({ method: 'gte', args: ['publication_year', 1800] })
    expect(calls(b, 'lte')).toContainEqual({ method: 'lte', args: ['publication_year', 1899] })
    expect(calls(b, 'gte')).toContainEqual({ method: 'gte', args: ['word_count', 120_000] })
    expect(call(b, 'order')!.args).toEqual(['created_at', { ascending: false, nullsFirst: undefined }])
    expect(call(b, 'range')!.args).toEqual([0, 23])

    expect(res.total).toBe(50)
    expect(res.hits[0].href).toBe('/book/dracula')
    expect(res.hits[0].title).toBe('Dracula')
  })

  it('omits the text predicate when query is blank', async () => {
    const client = fixed([BOOK_ROW], 1)
    await searchEntity(client, { entity: 'book', query: '   ' })
    expect(call(lastBuilder(client), 'or')).toBeUndefined()
  })

  it('falls back to the default sort for an unknown sort token', async () => {
    const client = fixed([BOOK_ROW], 1)
    await searchEntity(client, { entity: 'book', sort: 'bogus' })
    expect(call(lastBuilder(client), 'order')!.args[0]).toBe('weighted_rating')
  })
})

describe('searchEntity — per-entity base predicates + filters', () => {
  it('clubs are restricted to public and filter by genre_tags', async () => {
    const client = fixed([], 0)
    await searchEntity(client, { entity: 'club', filters: { genreTag: 'sci-fi' } })
    const b = lastBuilder(client)
    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['visibility', 'public'] })
    expect(call(b, 'contains')!.args).toEqual(['genre_tags', ['sci-fi']])
  })

  it('people are restricted to public profiles', async () => {
    const client = fixed([], 0)
    await searchEntity(client, { entity: 'person', query: 'ada' })
    expect(calls(lastBuilder(client), 'eq')).toContainEqual({ method: 'eq', args: ['is_public', true] })
  })

  it('lists are restricted to public', async () => {
    const client = fixed([], 0)
    await searchEntity(client, { entity: 'list' })
    expect(calls(lastBuilder(client), 'eq')).toContainEqual({ method: 'eq', args: ['is_public', true] })
  })

  it('quotes are restricted to public highlights', async () => {
    const client = fixed([], 0)
    await searchEntity(client, { entity: 'quote' })
    const b = lastBuilder(client)
    expect(call(b, 'from')!.args[0]).toBe('highlights')
    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['is_public', true] })
  })

  it('journal restricts to published and filters by tag', async () => {
    const client = fixed([], 0)
    await searchEntity(client, { entity: 'journal', filters: { tag: 'craft' } })
    const b = lastBuilder(client)
    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['is_published', true] })
    expect(call(b, 'contains')!.args).toEqual(['tags', ['craft']])
  })

  it('picks restrict to published, search the embedded book, and filter year/era', async () => {
    const client = fixed([], 0)
    await searchEntity(client, {
      entity: 'pick',
      query: 'austen',
      filters: { year: 2021, era: 'early-1900s' },
    })
    const b = lastBuilder(client)
    expect(call(b, 'from')!.args[0]).toBe('external_book_club_picks')
    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['is_published', true] })
    expect(call(b, 'or')!.args).toEqual([
      'title.ilike.%austen%,author.ilike.%austen%',
      { referencedTable: 'book' },
    ])
    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['pick_year', 2021] })
    expect(calls(b, 'gte')).toContainEqual({ method: 'gte', args: ['book.publication_year', 1900] })
  })

  it('authors dedupe by slug within a page', async () => {
    const client = new FakeClient(() => ({
      data: [
        { author: 'Bram Stoker', author_slug: 'bram-stoker' },
        { author: 'Bram Stoker', author_slug: 'bram-stoker' },
        { author: 'Mary Shelley', author_slug: 'mary-shelley' },
      ],
      count: 3,
      error: null,
    }))
    const res = await searchEntity(client, { entity: 'author', query: 'a' })
    expect(res.hits).toHaveLength(2)
    expect(res.hits[0].href).toBe('/author/bram-stoker')
  })
})

// ── pagination ──────────────────────────────────────────────────────────────

describe('pagination', () => {
  it('advances the offset via cursor and emits the next cursor', async () => {
    const client = fixed([BOOK_ROW], 50)
    const res = await searchEntity(client, {
      entity: 'book',
      cursor: encodeCursor(24),
      limit: 24,
    })
    expect(call(lastBuilder(client), 'range')!.args).toEqual([24, 47])
    expect(decodeCursor(res.nextCursor)).toBe(48)
  })

  it('returns a null cursor on the last page', async () => {
    const client = fixed([BOOK_ROW], 40)
    const res = await searchEntity(client, {
      entity: 'book',
      cursor: encodeCursor(24),
      limit: 24,
    })
    expect(res.nextCursor).toBeNull()
  })

  it('clamps the page size to the max', async () => {
    const client = fixed([BOOK_ROW], 9999)
    await searchEntity(client, { entity: 'book', limit: 100000 })
    expect(call(lastBuilder(client), 'range')!.args).toEqual([0, 99])
  })
})

// ── federated ───────────────────────────────────────────────────────────────

describe('searchFederated', () => {
  it('groups non-empty entities, counts them, and skips empties', async () => {
    const client = new FakeClient((table) =>
      table === 'books'
        ? { data: [BOOK_ROW], count: 3, error: null }
        : { data: [], count: 0, error: null },
    )
    const res = await searchFederated(client, { query: 'dracula', entities: ['book', 'club'] })
    expect(res.groups).toHaveLength(1)
    expect(res.groups[0].entity).toBe('book')
    expect(res.groups[0].total).toBe(3)
    expect(res.total).toBe(3)
  })

  it('is resilient: one entity erroring does not blank the rest', async () => {
    const client = new FakeClient((table) =>
      table === 'clubs'
        ? { data: null, count: null, error: { message: 'rls denied' } }
        : { data: [BOOK_ROW], count: 1, error: null },
    )
    const res = await searchFederated(client, { query: 'x', entities: ['book', 'club'] })
    expect(res.groups.map((g) => g.entity)).toEqual(['book'])
  })

  it('returns empty for a blank query without touching the client', async () => {
    const client = fixed([BOOK_ROW], 1)
    const res = await searchFederated(client, { query: '  ' })
    expect(res.groups).toHaveLength(0)
    expect(client.fromCalls).toHaveLength(0)
  })
})

// ── RLS-as-viewer (the castle wall) ─────────────────────────────────────────

describe('RLS safety', () => {
  it('queries only through the injected (viewer) client', async () => {
    const client = fixed([BOOK_ROW], 1)
    await searchEntity(client, { entity: 'book', query: 'x' })
    expect(client.fromCalls).toContain('books')
  })

  it('the core never imports the service-role / admin client', () => {
    const base = join(import.meta.dirname, '..', 'lib', 'search')
    for (const file of ['query.ts', 'adapters.ts', 'escape.ts', 'types.ts']) {
      const src = readFileSync(join(base, file), 'utf8')
      // Match real admin usage, not prose: the import path, the factory, or the
      // service-role env key. The core must use only the injected viewer client.
      expect(src).not.toMatch(/createAdminClient|SERVICE_ROLE_KEY|['"]@?\/?lib\/supabase\/admin['"]/)
    }
  })
})

// ── embed shape (PostgREST to-one normalization) ────────────────────────────
// Regression guard for the /quotes 500: highlights.user_id FKs to auth.users,
// not public.profiles, so the old `author:user_id(...)` embed 400'd (PGRST200)
// and crashed the page. The author is now joined separately; the to-one book
// embed is normalized so a stray array can never reach a card as `undefined`.

describe('embed shape', () => {
  it('quote adapter does not request the unresolvable highlights->profiles embed', () => {
    const cols = getAdapter('quote').selectColumns
    expect(cols).not.toMatch(/author:user_id/)
    expect(cols).toContain('user_id')
  })

  it('quote mapRow normalizes an array-shaped book embed to a single object', () => {
    const hit = getAdapter('quote').mapRow({
      id: 'h1',
      text: 'a passage',
      user_id: 'u1',
      book: [
        { id: 'b1', slug: 'dracula', title: 'Dracula', author: 'Stoker', cover_url: 'x.jpg' },
      ],
    })
    expect(hit.subtitle).toBe('Dracula · Stoker')
    expect(hit.imageUrl).toBe('x.jpg')
    const data = hit.data as { book: { title: string } | null; user_id: string }
    expect(data.book?.title).toBe('Dracula')
    expect(data.user_id).toBe('u1')
  })

  it('quote mapRow tolerates a null book without throwing', () => {
    const hit = getAdapter('quote').mapRow({ id: 'h2', text: 't', user_id: 'u2', book: null })
    expect(hit.subtitle).toBeNull()
    expect(hit.imageUrl).toBeNull()
  })

  it('pick mapRow normalizes array-shaped book/club embeds', () => {
    const hit = getAdapter('pick').mapRow({
      id: 'p1',
      book: [{ id: 'b9', slug: 's9', title: 'T', author: 'A', cover_url: 'c.jpg' }],
      club: [{ id: 'c9', slug: 'cs', name: 'Club', short_name: 'C' }],
    })
    expect(hit.title).toBe('T')
    expect(hit.subtitle).toBe('A · Club')
    expect(hit.imageUrl).toBe('c.jpg')
  })
})

// ── filter-config URL <-> params ────────────────────────────────────────────

const BOOK_CONFIG: FilterBarConfig = {
  entity: 'book',
  searchPlaceholder: 'Search books',
  defaultSort: 'relevance',
  sorts: [
    { value: 'relevance', label: 'Best match' },
    { value: 'newest', label: 'Newest' },
  ],
  facets: [
    {
      type: 'select',
      key: 'era',
      label: 'Era',
      param: 'era',
      options: [{ value: '1800s', label: '1800s' }],
    },
    {
      type: 'chips',
      key: 'mood',
      label: 'Mood',
      param: 'mood',
      multiple: true,
      options: [
        { value: 'gothic', label: 'Gothic' },
        { value: 'cozy', label: 'Cozy' },
      ],
    },
  ],
}

describe('filter-config', () => {
  it('parses URL params into typed search params', () => {
    const p = paramsToSearch('book', BOOK_CONFIG, {
      q: 'dracula',
      sort: 'newest',
      era: '1800s',
      mood: ['gothic', 'cozy'],
    })
    expect(p).toMatchObject({
      entity: 'book',
      query: 'dracula',
      sort: 'newest',
      filters: { era: '1800s', mood: ['gothic', 'cozy'] },
    })
  })

  it('falls back to the default sort and drops invalid facet values', () => {
    const p = paramsToSearch('book', BOOK_CONFIG, {
      sort: 'bogus',
      era: 'not-an-era',
      mood: ['gothic', 'invalid'],
    })
    expect(p.sort).toBe('relevance')
    const f = p.filters as Record<string, unknown>
    expect(f.era).toBeUndefined()
    expect(f.mood).toEqual(['gothic'])
  })

  it('serializes state back to params, omitting the default sort', () => {
    const out = searchToParams(BOOK_CONFIG, {
      query: 'dracula',
      sort: 'relevance',
      filters: { era: '1800s', mood: ['gothic'] },
    })
    expect(out).toEqual({ q: 'dracula', era: '1800s', mood: ['gothic'] })
    expect(out.sort).toBeUndefined()
  })
})
