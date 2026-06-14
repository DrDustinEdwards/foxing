import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchEntity, searchFederated } from '@/lib/search/query'
import {
  isSearchEntity,
  type SearchClient,
  type SearchEntity,
  type SearchParams,
} from '@/lib/search/types'

/**
 * Transport for the federated search core. Runs queries as the VIEWER (cookie
 * client → RLS), never the service role. Both /search and the command palette
 * consume this single endpoint.
 */
export const dynamic = 'force-dynamic'

function parseEntities(raw: string | null): SearchEntity[] | undefined {
  if (!raw) return undefined
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(isSearchEntity)
  return list.length ? list : undefined
}

function parseFilters(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const mode = sp.get('mode') ?? 'federated'
  const query = sp.get('q') ?? ''

  // Viewer-scoped client. RLS applies as this request's role.
  const supabase = await createClient()
  const client = supabase as unknown as SearchClient

  try {
    if (mode === 'entity') {
      const entityRaw = sp.get('entity')
      if (!entityRaw || !isSearchEntity(entityRaw)) {
        return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
      }
      const limitRaw = sp.get('limit')
      const params: SearchParams<SearchEntity> = {
        entity: entityRaw,
        query,
        sort: sp.get('sort') ?? undefined,
        cursor: sp.get('cursor'),
        limit: limitRaw ? Number(limitRaw) : undefined,
        filters: parseFilters(sp.get('f')) as never,
      }
      const result = await searchEntity(client, params)
      return NextResponse.json(result)
    }

    const limitRaw = sp.get('limit')
    const result = await searchFederated(client, {
      query,
      entities: parseEntities(sp.get('entities')),
      perEntityLimit: limitRaw ? Number(limitRaw) : undefined,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
