// Foxing BOTM picker.
// Scheduled job (cron in Supabase or external scheduler) that reads
// the score_botm_candidates() RPC, picks the top candidate, writes
// a draft Book of the Month row for next month, and notifies admins.
//
// The job is gated by a shared secret in the Authorization header so a
// public deployment endpoint can be safely exposed.

// @ts-expect-error remote import (Deno runtime resolves at deploy time)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-expect-error remote import (Deno runtime resolves at deploy time)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-expect-error Deno is provided by the Supabase Edge Function runtime.
declare const Deno: { env: { get(key: string): string | undefined } }

interface BotmCandidate {
  id: string
  title: string
  author: string
  cover_url: string | null
  finished_count: number | string | null
  highlight_count: number | string | null
  total_score: number | string | null
}

interface AdminRow {
  id: string
}

serve(async (req: Request): Promise<Response> => {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  )
  const year = nextMonth.getUTCFullYear()
  const month = nextMonth.getUTCMonth() + 1

  const { data: existing } = await supabase
    .from('book_of_the_month')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    return new Response(
      JSON.stringify({
        skipped: true,
        reason: 'pick_already_exists',
        year,
        month,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data: candidates, error: rpcError } = await supabase.rpc(
    'score_botm_candidates',
  )
  if (rpcError) {
    return new Response(
      JSON.stringify({ error: 'rpc_failed', detail: rpcError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const list = (candidates as BotmCandidate[] | null) ?? []
  if (list.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'no_candidates' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const pick = list[0]
  const monthName = nextMonth.toLocaleString('en-US', { month: 'long' })
  const finishedCount = Number(pick.finished_count ?? 0)
  const highlightCount = Number(pick.highlight_count ?? 0)

  let note =
    `${pick.title} by ${pick.author} had ${finishedCount} reader` +
    `${finishedCount === 1 ? '' : 's'} finish it this past month, ` +
    `more than almost any other book in the catalog.`
  if (highlightCount > 0) {
    note +=
      ` Readers saved ${highlightCount} passage` +
      `${highlightCount === 1 ? '' : 's'} from it.`
  }

  const { error: insertError } = await supabase
    .from('book_of_the_month')
    .insert({
      book_id: pick.id,
      year,
      month,
      category: 'fiction',
      curator_note: note,
      is_published: false,
    })
  if (insertError) {
    return new Response(
      JSON.stringify({ error: 'insert_failed', detail: insertError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
  const adminList = (admins as AdminRow[] | null) ?? []
  if (adminList.length > 0) {
    await supabase.from('notifications').insert(
      adminList.map((a) => ({
        user_id: a.id,
        type: 'admin_botm_ready',
        title: `${monthName} Book of the Month draft ready`,
        body: `"${pick.title}" by ${pick.author}. Review and approve in the admin dashboard.`,
        data: { action: 'review_botm', year, month, book_id: pick.id },
      })),
    )
  }

  return new Response(
    JSON.stringify({
      picked: { id: pick.id, title: pick.title, author: pick.author },
      year,
      month,
      notified_admins: adminList.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
