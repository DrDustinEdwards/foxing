import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Vercel cron invokes registered paths with GET. This was POST-only, so every
// scheduled tick returned 405 and old versions were never cleaned up.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const { error, count } = await supabase
    .from('journal_post_versions')
    .delete({ count: 'exact' })
    .lt('saved_at', cutoff.toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    deleted: count ?? 0,
    cutoff: cutoff.toISOString(),
  })
}
