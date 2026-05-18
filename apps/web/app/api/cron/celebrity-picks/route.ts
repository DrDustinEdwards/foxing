import { NextResponse, type NextRequest } from 'next/server'

/**
 * Vercel Cron handler for the celebrity-picks monthly run.
 *
 * Vercel calls this on the 2nd and 12th of each month (per vercel.json).
 * Vercel includes its own `Authorization: Bearer <CRON_SECRET>` header on
 * cron-triggered requests. We forward the trigger to the Supabase Edge
 * Function, which does the actual scraping and Claude calls. The two
 * secrets are kept separate so we can rotate Vercel's caller secret
 * without touching the Supabase deploy.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_FUNCTION_URL =
  'https://ekjpsuewrkvqzbuteurc.supabase.co/functions/v1/celebrity-pick-finder'

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseSecret = process.env.SUPABASE_CRON_SECRET
  if (!supabaseSecret) {
    return NextResponse.json(
      { error: 'SUPABASE_CRON_SECRET not configured' },
      { status: 500 },
    )
  }

  let response: Response
  try {
    response = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'vercel_cron' }),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'edge_function_unreachable',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    )
  }

  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text }
  }

  return NextResponse.json(
    { ok: response.ok, status: response.status, result: body },
    { status: response.ok ? 200 : 502 },
  )
}
