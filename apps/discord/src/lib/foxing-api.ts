declare const __FOXING_API__: string

const BASE = typeof __FOXING_API__ === 'string' ? __FOXING_API__ : ''

export interface ClubSummary {
  id: string
  slug: string | null
  name: string
  member_count: number | null
  current_book: { id: string; title: string; author: string } | null
}

export interface MemberProgress {
  user_id: string
  display_name: string
  avatar_url: string | null
  progress_percentage: number | null
  status: string | null
}

export interface PollOption {
  id: string
  label: string
  vote_count: number
}

export interface ActivePoll {
  id: string
  title: string
  poll_type: string
  closes_at: string | null
  options: PollOption[]
  my_vote: string | null
}

export interface ChapterReactionRow {
  id: string
  chapter_name: string
  emoji: string
  note: string | null
  display_name: string
}

export interface ClubDashboardData {
  current_book: { id: string; title: string; author: string } | null
  discussion_questions: { question: string; theme?: string }[]
  chapter_reactions: ChapterReactionRow[]
  active_poll: ActivePoll | null
  member_progress: MemberProgress[]
}

export interface SprintStatus {
  id: string
  club_id: string
  starts_at: string
  ends_at: string
  pages_logged: number
  participant_count: number
}

async function fetchJson<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return (await res.json()) as T
}

export function fetchClubs(token: string): Promise<ClubSummary[]> {
  return fetchJson<{ clubs: ClubSummary[] }>('/api/discord/clubs', token).then(
    (r) => r.clubs,
  )
}

export function fetchDashboard(
  token: string,
  clubId: string,
): Promise<ClubDashboardData> {
  return fetchJson<ClubDashboardData>(
    `/api/discord/club/${clubId}/dashboard`,
    token,
  )
}

export function addReaction(
  token: string,
  clubId: string,
  body: { chapter_name: string; emoji: string; note?: string | null },
): Promise<{ ok: boolean }> {
  return fetchJson(`/api/discord/club/${clubId}/react`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function castVote(
  token: string,
  clubId: string,
  body: { poll_id: string; option_id: string },
): Promise<{ ok: boolean }> {
  return fetchJson(`/api/discord/club/${clubId}/vote`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function startSprint(
  token: string,
  body: { club_id: string; duration_minutes: number },
): Promise<{ sprint: SprintStatus }> {
  return fetchJson('/api/discord/sprint/start', token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchSprint(
  token: string,
  sprintId: string,
): Promise<SprintStatus> {
  return fetchJson(`/api/discord/sprint/${sprintId}`, token)
}

export function logSprint(
  token: string,
  sprintId: string,
  pages_read: number,
): Promise<{ ok: boolean }> {
  return fetchJson(`/api/discord/sprint/${sprintId}/log`, token, {
    method: 'POST',
    body: JSON.stringify({ pages_read }),
  })
}
