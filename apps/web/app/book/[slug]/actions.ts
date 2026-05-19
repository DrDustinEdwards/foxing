'use server'

import { revalidatePath } from 'next/cache'
import {
  generateAndStoreDiscussionGuide,
  type DiscussionQuestion,
} from '@/lib/discussion-guide'

interface Result {
  ok: boolean
  questions?: DiscussionQuestion[]
  error?: string
}

export async function generateDiscussionGuide(
  formData: FormData,
): Promise<Result> {
  const bookId = String(formData.get('book_id') ?? '').trim()
  const bookSlug = String(formData.get('book_slug') ?? '').trim()
  if (!bookId) return { ok: false, error: 'Missing book id.' }
  try {
    const guide = await generateAndStoreDiscussionGuide(bookId)
    if (!guide) return { ok: false, error: 'Could not generate guide.' }
    if (bookSlug) revalidatePath(`/book/${bookSlug}`)
    return { ok: true, questions: guide.questions }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Generation failed.',
    }
  }
}
