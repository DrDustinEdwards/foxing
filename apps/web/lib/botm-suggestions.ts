import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export interface BotmCandidate {
  id: string
  title: string
  author: string
  cover_url: string | null
  finished_count: number
  highlight_count: number
  total_score: number
}

export async function fetchBotmCandidates(): Promise<BotmCandidate[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('score_botm_candidates')
  if (error || !Array.isArray(data)) return []
  return (data as Array<{
    id: string
    title: string
    author: string
    cover_url: string | null
    finished_count: number | string | null
    highlight_count: number | string | null
    total_score: number | string | null
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    cover_url: row.cover_url,
    finished_count: Number(row.finished_count ?? 0),
    highlight_count: Number(row.highlight_count ?? 0),
    total_score: Number(row.total_score ?? 0),
  }))
}

export function generateCuratorNote(candidate: BotmCandidate): string {
  const lines: string[] = []
  lines.push(
    `${candidate.title} by ${candidate.author} had ${candidate.finished_count} reader${
      candidate.finished_count === 1 ? '' : 's'
    } finish it this month, more than almost any other book in the catalog.`,
  )
  if (candidate.highlight_count > 0) {
    lines.push(
      `Readers saved ${candidate.highlight_count} passage${
        candidate.highlight_count === 1 ? '' : 's'
      } from it.`,
    )
  }
  return lines.join(' ')
}
