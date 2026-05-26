import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUserId } from '@/lib/nav-user'

interface LinkRow {
  position: number
  target: {
    id: string
    slug: string
    title: string
  } | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('journal_post_links')
    .select('position, target:target_id(id, slug, title)')
    .eq('source_id', id)
    .order('position', { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const rows = (data as unknown as LinkRow[] | null) ?? []
  const links = rows
    .filter((r): r is LinkRow & { target: NonNullable<LinkRow['target']> } =>
      r.target !== null,
    )
    .map((r) => r.target)
  return NextResponse.json({ links })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let payload: { targetIds?: unknown }
  try {
    payload = (await request.json()) as { targetIds?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const targetIds = Array.isArray(payload.targetIds)
    ? (payload.targetIds.filter(
        (x): x is string => typeof x === 'string' && x.length > 0,
      ) as string[])
    : []

  const admin = createAdminClient()
  const { error: delError } = await admin
    .from('journal_post_links')
    .delete()
    .eq('source_id', id)
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }
  if (targetIds.length > 0) {
    const rows = targetIds
      .filter((tid) => tid !== id)
      .map((tid, position) => ({
        source_id: id,
        target_id: tid,
        position,
      }))
    if (rows.length > 0) {
      const { error: insError } = await admin
        .from('journal_post_links')
        .insert(rows)
      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 })
      }
    }
  }
  return NextResponse.json({ ok: true })
}
