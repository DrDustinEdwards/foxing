import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

interface FinishedRow {
  rating_half: number | null
  mood_tags: string[] | null
  finished_at: string | null
  book: {
    title: string | null
    author: string | null
    themes: string[] | null
  } | null
}

const COLS =
  'rating_half, mood_tags, finished_at, book:book_id(title, author, themes)' as const

const PROMPT_INSTRUCTION =
  'Write a single line of at most 12 words that captures this person\'s reading personality based on the data below. No quotes, no preamble, no period at the end. Be specific and a little witty. Output ONLY the line.'

function topN(values: string[], n: number): string[] {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

function trimLine(text: string): string {
  return text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\.\s*$/, '')
    .trim()
    .slice(0, 200)
}

export async function generateReadingPersonality(
  userId: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_books')
    .select(COLS)
    .eq('user_id', userId)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(50)
  const rows = (data as unknown as FinishedRow[] | null) ?? []
  if (rows.length < 3) return null

  const themes: string[] = []
  const moods: string[] = []
  const authorCounts = new Map<string, number>()
  const ratings: number[] = []
  const recentTitles: string[] = []
  for (const r of rows) {
    for (const t of r.book?.themes ?? []) themes.push(t)
    for (const m of r.mood_tags ?? []) moods.push(m)
    if (r.book?.author)
      authorCounts.set(
        r.book.author,
        (authorCounts.get(r.book.author) ?? 0) + 1,
      )
    if (typeof r.rating_half === 'number') ratings.push(r.rating_half / 2)
    if (r.book?.title && recentTitles.length < 5) recentTitles.push(r.book.title)
  }
  const topThemes = topN(themes, 5)
  const topMoods = topN(moods, 4)
  const favoriteAuthor = [...authorCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0]
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null

  const promptBody = [
    `Books finished: ${rows.length}`,
    avgRating ? `Average rating: ${avgRating.toFixed(1)}/5` : null,
    favoriteAuthor ? `Most-read author: ${favoriteAuthor}` : null,
    topThemes.length > 0 ? `Top themes: ${topThemes.join(', ')}` : null,
    topMoods.length > 0 ? `Top moods: ${topMoods.join(', ')}` : null,
    recentTitles.length > 0
      ? `Recent titles: ${recentTitles.join('; ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

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
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `${PROMPT_INSTRUCTION}\n\n${promptBody}`,
          },
        ],
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      content?: Array<{ text?: string }>
    }
    const raw = json.content?.[0]?.text ?? ''
    const line = trimLine(raw)
    if (!line) return null
    const { error } = await admin
      .from('profiles')
      .update({ reading_personality: line })
      .eq('id', userId)
    if (error) return null
    return line
  } catch {
    return null
  }
}

export function maybeRegeneratePersonality(
  userId: string,
  finishedCount: number,
): void {
  if (finishedCount === 3 || (finishedCount > 0 && finishedCount % 10 === 0)) {
    void generateReadingPersonality(userId)
  }
}
