import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Vercel cron invokes registered paths with GET. This was POST-only, so every
// scheduled tick returned 405 and scheduled posts never published.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: due, error: fetchErr } = await supabase
    .from('journal_posts')
    .select('id, slug, title')
    .eq('is_published', false)
    .not('published_at', 'is', null)
    .lte('published_at', now)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const rows =
    (due as { id: string; slug: string; title: string }[] | null) ?? []
  if (rows.length === 0) {
    return NextResponse.json({ published: 0, message: 'No posts due' })
  }

  const ids = rows.map((p) => p.id)
  const { error: updateErr } = await supabase
    .from('journal_posts')
    .update({ is_published: true })
    .in('id', ids)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    published: rows.length,
    posts: rows.map((p) => ({ id: p.id, slug: p.slug, title: p.title })),
  })
}
