import { supabase } from './supabase'

type Action = 'word_lookup' | 'passage_analysis' | 'chapter_summary' | 'chat'

// Calls go through the ai-companion Edge Function so the Anthropic key never
// ships to the device. supabase.functions.invoke() automatically attaches the
// signed-in user's JWT (or the project's anon key as a fallback). The Edge
// Function is configured with verify_jwt: true and rejects raw publishable
// keys with UNAUTHORIZED_INVALID_JWT_FORMAT — so we MUST go through invoke(),
// not raw fetch with EXPO_PUBLIC_SUPABASE_ANON_KEY.
async function callAiCompanion(action: Action, payload: unknown): Promise<string> {
  const startedAt = Date.now()
  console.log('[claude] →', action, summarize(payload))

  const { data, error } = await supabase.functions.invoke<{ result?: string; error?: string }>(
    'ai-companion',
    { body: { action, payload } },
  )

  const elapsedMs = Date.now() - startedAt

  if (error) {
    // FunctionsHttpError (non-2xx), FunctionsRelayError (network/CORS),
    // FunctionsFetchError (transport). All have .message and FunctionsHttpError
    // also exposes .context (the Response).
    let detail = error.message
    const ctx = (error as unknown as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      try {
        const body = await ctx.text()
        if (body) detail += ` — ${body}`
      } catch {
        // ignore — context already consumed
      }
    }
    console.warn('[claude] ✕', action, `${elapsedMs}ms`, detail)
    throw new Error(detail)
  }

  if (data?.error) {
    console.warn('[claude] ✕', action, `${elapsedMs}ms`, data.error)
    throw new Error(data.error)
  }

  const result = data?.result ?? ''
  console.log('[claude] ✓', action, `${elapsedMs}ms`, `${result.length} chars`)
  return result
}

// Tiny payload summary for logs — avoids dumping the entire chat history
// or a multi-paragraph passage into Metro output.
function summarize(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof value === 'string') {
      out[key] = value.length > 60 ? `${value.slice(0, 60)}… (${value.length})` : value
    } else if (Array.isArray(value)) {
      out[key] = `Array(${value.length})`
    } else {
      out[key] = value
    }
  }
  return out
}

export async function lookupWord(
  word: string,
  sentence: string,
  bookTitle: string,
  author: string,
  era: string,
): Promise<string> {
  return callAiCompanion('word_lookup', { word, sentence, bookTitle, author, era })
}

export async function analyzePassage(
  passage: string,
  analysisType: 'rewrite' | 'historical' | 'literary' | 'thematic' | 'motivation',
  bookTitle: string,
  author: string,
  era: string,
): Promise<string> {
  return callAiCompanion('passage_analysis', {
    passage,
    analysisType,
    bookTitle,
    author,
    era,
  })
}

export async function getChapterSummary(
  chapterTitle: string,
  chapterNumber: number,
  timing: 'before' | 'after',
  bookTitle: string,
  author: string,
  previousChapterContent?: string,
): Promise<string> {
  return callAiCompanion('chapter_summary', {
    chapterTitle,
    chapterNumber,
    timing,
    bookTitle,
    author,
    previousChapterContent,
  })
}

export async function chatWithCompanion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  bookTitle: string,
  author: string,
  currentChapter: string,
  spoilerFree: boolean,
): Promise<string> {
  return callAiCompanion('chat', {
    messages,
    bookTitle,
    author,
    currentChapter,
    spoilerFree,
  })
}
