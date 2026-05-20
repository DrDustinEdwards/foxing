import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DiscussionQuestion {
  question: string
  theme?: string
}

export interface DiscussionGuide {
  id: string
  book_id: string
  questions: DiscussionQuestion[]
  generated_at: string
  model: string
}

export async function fetchDiscussionGuide(
  bookId: string,
): Promise<DiscussionGuide | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }
  const sb = createClient()
  const { data } = await sb
    .from('book_discussion_guides')
    .select('id, book_id, questions, generated_at, model')
    .eq('book_id', bookId)
    .maybeSingle()
  return (data as DiscussionGuide | null) ?? null
}

interface BookForGuide {
  title: string
  author: string
  description: string | null
  themes: string[] | null
}

async function callClaudeForGuide(
  book: BookForGuide,
): Promise<DiscussionQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured.')

  const themeLine =
    book.themes && book.themes.length > 0
      ? `Themes: ${book.themes.join(', ')}\n`
      : ''
  const descLine = book.description
    ? `Description: ${book.description.slice(0, 1200)}\n`
    : ''

  const prompt = `Generate 12-15 discussion questions for a book club reading ${book.title} by ${book.author}.
${descLine}${themeLine}
Return ONLY a JSON array, no markdown, no preamble:
[{"question": "...", "theme": "Characters"}, ...]

Themes should be one of: Characters, Plot, Themes, Setting, Writing Style, Personal Response, Broader Context.
Make questions open-ended, thought-provoking, and suitable for a 90-minute discussion.
Vary difficulty. Include at least 2 questions about the writing itself, not just plot.`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`)
  }
  const data = (await res.json()) as {
    content?: Array<{ text?: string }>
  }
  const text = data.content?.[0]?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in model response.')
  const parsed = JSON.parse(match[0]) as DiscussionQuestion[]
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Model returned an empty or invalid array.')
  }
  return parsed
    .filter((q) => typeof q?.question === 'string' && q.question.trim().length > 0)
    .map((q) => ({
      question: q.question.trim(),
      theme: typeof q.theme === 'string' ? q.theme : undefined,
    }))
}

export async function generateAndStoreDiscussionGuide(
  bookId: string,
): Promise<DiscussionGuide | null> {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('book_discussion_guides')
    .select('id, book_id, questions, generated_at, model')
    .eq('book_id', bookId)
    .maybeSingle()
  if (existing) return existing as DiscussionGuide

  const { data: bookRow } = await admin
    .from('books')
    .select('title, author, description, themes')
    .eq('id', bookId)
    .maybeSingle()
  const book = bookRow as BookForGuide | null
  if (!book) return null

  const model = 'claude-sonnet-4-20250514'
  const questions = await callClaudeForGuide(book)
  const { data: inserted, error } = await admin
    .from('book_discussion_guides')
    .insert({
      book_id: bookId,
      questions,
      model,
    })
    .select('id, book_id, questions, generated_at, model')
    .single()
  if (error) throw new Error(error.message)
  return inserted as DiscussionGuide
}
