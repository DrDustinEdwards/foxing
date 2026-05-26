import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024
const DAILY_LIMIT = 5

const PROMPT =
  'Extract the readable text from this book page photograph. Return ONLY the extracted text, preserving paragraph breaks. If text is unclear or image is not a book page, return empty string.'

export async function POST(request: NextRequest) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const admin = createAdminClient()
  const { data: rateRow } = await admin
    .from('ai_rate_limits')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()
  const currentCount =
    (rateRow as { count: number | null } | null)?.count ?? 0
  if (currentCount >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: 'Daily AI limit reached', limit: DAILY_LIMIT },
      { status: 429 },
    )
  }
  await admin
    .from('ai_rate_limits')
    .upsert(
      { user_id: user.id, date: today, count: currentCount + 1 },
      { onConflict: 'user_id,date' },
    )

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'image_too_large' }, { status: 413 })
  }

  const buf = await file.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mediaType = file.type || 'image/jpeg'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'model_error', status: res.status },
        { status: 502 },
      )
    }
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>
    }
    const text = (data.content?.[0]?.text ?? '').trim()
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'extract_failed' }, { status: 500 })
  }
}
