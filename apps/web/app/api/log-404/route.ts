import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  path?: string
  referrer?: string | null
}

const FIELD_MAX = 500

function clamp(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, FIELD_MAX)
}

export async function POST(request: NextRequest) {
  // Best effort: always return 200 so the not-found page never bubbles
  // a client-side error from a missing log table or service issue.
  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: true })
  }
  const path = clamp(body.path)
  if (!path) return NextResponse.json({ ok: true })
  const referrer = clamp(body.referrer ?? null)
  const userAgent = clamp(request.headers.get('user-agent'))

  try {
    const admin = createAdminClient()
    await admin.from('page_404s').insert({
      path,
      referrer,
      user_agent: userAgent,
    })
  } catch {
    // Swallow: 404 logging must never escalate.
  }
  return NextResponse.json({ ok: true })
}
