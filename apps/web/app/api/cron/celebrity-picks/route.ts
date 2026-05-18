import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Vercel Cron handler for the celebrity-picks monthly run.
 *
 * Vercel calls this on the 2nd and 12th of each month (per vercel.json).
 * Vercel includes its own `Authorization: Bearer <CRON_SECRET>` header on
 * cron-triggered requests. We forward the trigger to the Supabase Edge
 * Function, which does the actual scraping and Claude calls. The two
 * secrets are kept separate so we can rotate Vercel's caller secret
 * without touching the Supabase deploy.
 *
 * After the Edge Function returns successfully, we revalidate the current
 * and previous month's roundup pages, every club's per-month detail page,
 * and every club's profile page so the full pick history shows the new
 * pick within seconds instead of waiting up to an hour for ISR.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_FUNCTION_URL =
  'https://ekjpsuewrkvqzbuteurc.supabase.co/functions/v1/celebrity-pick-finder'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

async function revalidateAfterPickRun(): Promise<void> {
  const now = new Date()
  const curYear = now.getUTCFullYear()
  const curMonth = now.getUTCMonth() + 1
  const cur = { year: curYear, month: curMonth }
  const prev = previousMonth(curYear, curMonth)

  revalidatePath('/book-clubs')
  revalidatePath(`/book-clubs/picks/${cur.year}/${pad2(cur.month)}`)
  revalidatePath(`/book-clubs/picks/${prev.year}/${pad2(prev.month)}`)

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('external_book_clubs')
      .select('slug')
    const slugs = (data as { slug: string }[] | null) ?? []
    for (const { slug } of slugs) {
      revalidatePath(`/book-clubs/${slug}`)
      revalidatePath(`/book-clubs/${slug}/${cur.year}/${pad2(cur.month)}`)
      revalidatePath(`/book-clubs/${slug}/${prev.year}/${pad2(prev.month)}`)
    }
  } catch {
    // If we cannot enumerate clubs, the cron still succeeded; the affected
    // pages will still revalidate on their own ISR window.
  }
}

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

  if (response.ok) {
    await revalidateAfterPickRun()
  }

  return NextResponse.json(
    { ok: response.ok, status: response.status, result: body },
    { status: response.ok ? 200 : 502 },
  )
}
