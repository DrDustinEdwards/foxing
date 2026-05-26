import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdminUserId } from '@/lib/nav-user'

export async function POST(request: NextRequest) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let payload: { slug?: unknown }
  try {
    payload = (await request.json()) as { slug?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : ''

  revalidatePath('/')
  revalidatePath('/journal')
  if (slug) revalidatePath(`/journal/${slug}`)

  return NextResponse.json({ ok: true })
}
