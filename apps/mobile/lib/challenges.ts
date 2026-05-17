// Reading challenges, personal goals and pre-seeded community challenges.
//
// SQL SCHEMA (applied externally):
//
//   create table challenges (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     description text,
//     type text not null check (type in ('books','pages','minutes','genres','streak')),
//     target integer not null,
//     deadline date,
//     is_community boolean not null default false,
//     created_by uuid references profiles(id) on delete set null,
//     created_at timestamptz not null default now()
//   );
//
//   create table user_challenges (
//     challenge_id uuid not null references challenges(id) on delete cascade,
//     user_id uuid not null references profiles(id) on delete cascade,
//     progress integer not null default 0,
//     joined_at timestamptz not null default now(),
//     primary key (challenge_id, user_id)
//   );

import { supabase } from './supabase'

export type ChallengeType = 'books' | 'pages' | 'minutes' | 'genres' | 'streak'

export const CHALLENGE_TYPES: Array<{ id: ChallengeType; label: string; unit: string }> = [
  { id: 'books', label: 'Books', unit: 'books' },
  { id: 'pages', label: 'Pages', unit: 'pages' },
  { id: 'minutes', label: 'Minutes', unit: 'minutes' },
  { id: 'genres', label: 'Genres', unit: 'genres' },
  { id: 'streak', label: 'Streak', unit: 'days' },
]

export interface Challenge {
  id: string
  name: string
  description: string | null
  type: ChallengeType
  target: number
  deadline: string | null
  is_community: boolean
  created_by: string | null
  created_at: string
}

export interface UserChallenge {
  challenge_id: string
  user_id: string
  progress: number
  joined_at: string
}

// Community challenges seeded if the table has none of them yet. Idempotent:
// uses upsert on a deterministic name key so multiple devices opening the
// app at once don't create duplicates.
const COMMUNITY_SEEDS: Array<Omit<Challenge, 'id' | 'created_by' | 'created_at'>> = [
  {
    name: 'Summer Reading',
    description: 'Read 5 books before September.',
    type: 'books',
    target: 5,
    deadline: `${new Date().getFullYear()}-09-01`,
    is_community: true,
  },
  {
    name: 'Genre Explorer',
    description: 'Read from 5 different genres this year.',
    type: 'genres',
    target: 5,
    deadline: `${new Date().getFullYear()}-12-31`,
    is_community: true,
  },
  {
    name: 'Classic Century',
    description: 'Read 10 books published before 1900.',
    type: 'books',
    target: 10,
    deadline: `${new Date().getFullYear()}-12-31`,
    is_community: true,
  },
]

export async function seedCommunityChallenges(): Promise<void> {
  const { data: existing } = await supabase
    .from('challenges')
    .select('name')
    .eq('is_community', true)
  const have = new Set(((existing ?? []) as Array<{ name: string }>).map((r) => r.name))
  const missing = COMMUNITY_SEEDS.filter((s) => !have.has(s.name))
  if (missing.length === 0) return
  const { error } = await supabase.from('challenges').insert(missing)
  if (error) console.warn('[challenges] seed failed:', error.message)
}

export async function listCommunityChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('is_community', true)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[challenges] listCommunity failed:', error.message)
    return []
  }
  return ((data ?? []) as Challenge[])
}

export async function listMyChallenges(userId: string): Promise<Array<Challenge & { progress: number }>> {
  // Two pulls: challenges the user has joined (any kind), and their progress rows.
  const { data: rows } = await supabase
    .from('user_challenges')
    .select('challenge_id, progress')
    .eq('user_id', userId)
  const joined = ((rows ?? []) as Array<{ challenge_id: string; progress: number }>)
  if (joined.length === 0) return []
  const progressMap = new Map(joined.map((r) => [r.challenge_id, r.progress]))
  const ids = joined.map((r) => r.challenge_id)
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .in('id', ids)
  return ((challenges ?? []) as Challenge[])
    .map((c) => ({ ...c, progress: progressMap.get(c.id) ?? 0 }))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
}

export async function createPersonalChallenge(input: {
  name: string
  description?: string | null
  type: ChallengeType
  target: number
  deadline: string | null
}): Promise<Challenge | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      target: input.target,
      deadline: input.deadline,
      is_community: false,
      created_by: user.id,
    })
    .select()
    .single()
  if (error) {
    console.warn('[challenges] create failed:', error.message)
    return null
  }
  const challenge = data as Challenge
  await supabase
    .from('user_challenges')
    .insert({ challenge_id: challenge.id, user_id: user.id, progress: 0 })
  return challenge
}

export async function joinChallenge(challengeId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('user_challenges')
    .insert({ challenge_id: challengeId, user_id: user.id, progress: 0 })
  if (error && !error.message.includes('duplicate')) {
    console.warn('[challenges] join failed:', error.message)
    return false
  }
  return true
}

export async function fetchLeaderboard(
  challengeId: string,
  limit = 5,
): Promise<Array<{
  user_id: string
  progress: number
  profile: { display_name: string | null; username: string | null; avatar_url: string | null } | null
}>> {
  const { data, error } = await supabase
    .from('user_challenges')
    .select(
      'user_id, progress, profile:profiles!user_id(display_name, username, avatar_url)',
    )
    .eq('challenge_id', challengeId)
    .order('progress', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[challenges] leaderboard failed:', error.message)
    return []
  }
  type R = {
    user_id: string
    progress: number
    profile: { display_name: string | null; username: string | null; avatar_url: string | null }
      | Array<{ display_name: string | null; username: string | null; avatar_url: string | null }>
      | null
  }
  return (((data ?? []) as unknown) as R[]).map((r) => ({
    user_id: r.user_id,
    progress: r.progress,
    profile: Array.isArray(r.profile) ? r.profile[0] ?? null : r.profile,
  }))
}
