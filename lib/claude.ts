import { supabase } from './supabase'

type Action =
  | 'word_lookup'
  | 'passage_analysis'
  | 'chapter_summary'
  | 'chat'
  | 'character_map'
  | 'word_wise'
  | 'semantic_search'

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

// All four functions accept optional `bookId`, `currentChapter`, and
// `progress` (0..1) so the Edge Function can stamp them into its
// per-request COMPANION_RESPONSE log line and inject them into the
// dynamic context block of the system prompt. Older callers that don't
// pass these still work — the Edge Function logs `undefined` and the
// prompt falls back to "(not provided)" / "unknown".

export interface CompanionContext {
  bookId?: string
  currentChapter?: string
  progress?: number
}

export async function lookupWord(
  word: string,
  sentence: string,
  bookTitle: string,
  author: string,
  era: string,
  context: CompanionContext = {},
): Promise<string> {
  return callAiCompanion('word_lookup', {
    word,
    sentence,
    bookTitle,
    author,
    era,
    ...context,
  })
}

export async function analyzePassage(
  passage: string,
  analysisType: 'rewrite' | 'historical' | 'literary' | 'thematic' | 'motivation',
  bookTitle: string,
  author: string,
  era: string,
  context: CompanionContext = {},
): Promise<string> {
  return callAiCompanion('passage_analysis', {
    passage,
    analysisType,
    bookTitle,
    author,
    era,
    ...context,
  })
}

export async function getChapterSummary(
  chapterTitle: string,
  chapterNumber: number,
  timing: 'before' | 'after',
  bookTitle: string,
  author: string,
  previousChapterContent?: string,
  context: CompanionContext = {},
): Promise<string> {
  return callAiCompanion('chapter_summary', {
    chapterTitle,
    chapterNumber,
    timing,
    bookTitle,
    author,
    previousChapterContent,
    ...context,
  })
}

export async function chatWithCompanion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  bookTitle: string,
  author: string,
  currentChapter: string,
  spoilerFree: boolean,
  context: Omit<CompanionContext, 'currentChapter'> = {},
): Promise<string> {
  return callAiCompanion('chat', {
    messages,
    bookTitle,
    author,
    currentChapter,
    spoilerFree,
    ...context,
  })
}

// Structured outputs from the new action types: each returns JSON. The
// Edge Function returns JSON-text (we asked Claude for JSON-only); we
// parse on the client and return typed objects. If parsing fails, surface
// a clear error so the host can render a "couldn't generate" state
// instead of crashing.

export interface CharacterEntry {
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | string
  description: string
  relationships: string[]
}

export async function getCharacterMap(
  bookTitle: string,
  author: string,
  currentChapter: string,
  context: CompanionContext = {},
): Promise<CharacterEntry[]> {
  const raw = await callAiCompanion('character_map', {
    bookTitle,
    author,
    currentChapter,
    ...context,
  })
  return parseJsonArrayResponse<CharacterEntry>(raw, 'characters')
}

export interface WordWiseHint {
  word: string
  hint: string
}

export async function getWordWiseHints(
  pageText: string,
  bookTitle: string,
  author: string,
  currentChapter: string,
  context: CompanionContext = {},
): Promise<WordWiseHint[]> {
  const raw = await callAiCompanion('word_wise', {
    pageText,
    bookTitle,
    author,
    currentChapter,
    ...context,
  })
  return parseJsonArrayResponse<WordWiseHint>(raw)
}

export interface SemanticSearchResult {
  chapterName: string
  confidence: 'high' | 'medium' | 'low'
  explanation: string
}

export async function semanticSearch(
  query: string,
  bookTitle: string,
  author: string,
  chapterList: string[],
  context: CompanionContext = {},
): Promise<SemanticSearchResult[]> {
  const raw = await callAiCompanion('semantic_search', {
    query,
    bookTitle,
    author,
    chapterList,
    ...context,
  })
  return parseJsonArrayResponse<SemanticSearchResult>(raw, 'results')
}

// Tolerate Claude wrapping JSON in markdown fences ``` ... ``` or in a
// containing object like { "characters": [ ... ] }. The optional `objectKey`
// arg picks the array out of an object response.
function parseJsonArrayResponse<T>(raw: string, objectKey?: string): T[] {
  if (!raw) return []
  let text = raw.trim()
  // Strip a single ```json ... ``` fence if present.
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) text = fenced[1].trim()
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed as T[]
    if (objectKey && parsed && typeof parsed === 'object' && Array.isArray(parsed[objectKey])) {
      return parsed[objectKey] as T[]
    }
    console.warn('[claude] unexpected JSON shape, returning empty:', Object.keys(parsed ?? {}))
    return []
  } catch (e) {
    console.warn('[claude] JSON parse failed:', e instanceof Error ? e.message : e, 'raw:', text.slice(0, 200))
    return []
  }
}
