import { supabase } from './supabase'

type Action =
  | 'word_lookup'
  | 'passage_analysis'
  | 'chapter_summary'
  | 'chat'
  | 'character_map'
  | 'word_wise'
  | 'semantic_search'
  | 'discussion_starter'
  | 'chapter_feature'
  | 'word_aspect'
  | 'bilingual_paragraph'
  | 'language_difficulty'
  | 'deep_dive'

// Edge Function failure codes the client cares about. These map 1:1 to
// the `error` field the Edge Function returns alongside HTTP status codes.
// All on-demand AI is now Plus-gated: free users get 403 PLUS_REQUIRED
// (there is no free quota / 429 RATE_LIMITED path anymore; the code is kept
// only as a defensive branch for infra-level throttling).
export type AiCompanionErrorCode =
  | 'RATE_LIMITED'
  | 'PLUS_REQUIRED'
  | 'UNAUTHENTICATED'

export class AiCompanionError extends Error {
  code: AiCompanionErrorCode
  constructor(code: AiCompanionErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AiCompanionError'
  }
}

const KNOWN_ERROR_CODES: AiCompanionErrorCode[] = [
  'RATE_LIMITED',
  'PLUS_REQUIRED',
  'UNAUTHENTICATED',
]

// User-facing text for the codes the Edge Function can return. Sheets pass
// the caught error here and display whatever string comes back.
export function friendlyAiError(e: unknown): string {
  if (e instanceof AiCompanionError) {
    if (e.code === 'PLUS_REQUIRED') {
      return 'This is a Foxing Plus feature.\nUpgrade at foxing.app to unlock the AI companion.'
    }
    if (e.code === 'RATE_LIMITED') {
      return 'Too many requests right now. Please try again in a moment.'
    }
    if (e.code === 'UNAUTHENTICATED') {
      return 'Sign in to use AI features.'
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong.'
}

// Calls go through the ai-companion Edge Function so the Anthropic key never
// ships to the device. supabase.functions.invoke() automatically attaches the
// signed-in user's JWT (or the project's anon key as a fallback). The Edge
// Function is configured with verify_jwt: true and rejects raw publishable
// keys with UNAUTHORIZED_INVALID_JWT_FORMAT, so we MUST go through invoke(),
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
    let parsedCode: AiCompanionErrorCode | null = null
    let parsedMessage: string | null = null
    const ctx = (error as unknown as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      try {
        const body = await ctx.text()
        if (body) {
          detail += `, ${body}`
          try {
            const json = JSON.parse(body) as { error?: string; message?: string }
            if (typeof json.error === 'string' && (KNOWN_ERROR_CODES as string[]).includes(json.error)) {
              parsedCode = json.error as AiCompanionErrorCode
            }
            if (typeof json.message === 'string') parsedMessage = json.message
          } catch {
            // body wasn't JSON, fine, fall through
          }
        }
      } catch {
        // ignore, context already consumed
      }
    }
    console.warn('[claude] ✕', action, `${elapsedMs}ms`, detail)
    if (parsedCode) {
      throw new AiCompanionError(parsedCode, parsedMessage ?? detail)
    }
    throw new Error(detail)
  }

  if (data?.error) {
    console.warn('[claude] ✕', action, `${elapsedMs}ms`, data.error)
    // Edge Function may also return error in the JSON body with 200; treat
    // the same as above so callers get a typed AiCompanionError.
    if ((KNOWN_ERROR_CODES as string[]).includes(data.error)) {
      throw new AiCompanionError(data.error as AiCompanionErrorCode, data.error)
    }
    throw new Error(data.error)
  }

  const result = data?.result ?? ''
  console.log('[claude] ✓', action, `${elapsedMs}ms`, `${result.length} chars`)
  return result
}

// Tiny payload summary for logs, avoids dumping the entire chat history
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
// pass these still work, the Edge Function logs `undefined` and the
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

export type PassageAnalysisType =
  | 'rewrite'
  | 'historical'
  | 'literary'
  | 'thematic'
  | 'motivation'
  | 'passage_comparison'
  | 'perspective'
  | 'readability'

export async function analyzePassage(
  passage: string,
  analysisType: PassageAnalysisType,
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

export type ChatMode =
  | 'normal'
  | 'spoiler_free'
  | 'socratic'
  | 'debate'
  | 'character_interview'
  | 'author_mode'
  | 'scholar'
  | 'child_esl'
  | 'comparative'
  | 'prediction'
  | 'emotional_check_in'
  | 'journal_prompts'

export async function chatWithCompanion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  bookTitle: string,
  author: string,
  currentChapter: string,
  spoilerFree: boolean,
  context: Omit<CompanionContext, 'currentChapter'> & { mode?: ChatMode } = {},
): Promise<string> {
  const { mode, ...rest } = context
  return callAiCompanion('chat', {
    messages,
    bookTitle,
    author,
    currentChapter,
    spoilerFree,
    mode: mode ?? 'normal',
    ...rest,
  })
}

// ── Chapter features (Phase B) ───────────────────────────────────────────

export type ChapterFeatureKind =
  | 'timeline'
  | 'characters'
  | 'themes'
  | 'pacing'
  | 'cliffhanger'
  | 'key_passage'
  | 'quiz'

export interface QuizQuestion {
  q: string
  choices: [string, string, string, string]
  correctIndex: number
  why: string
}

export async function getChapterFeature(
  kind: ChapterFeatureKind,
  input: {
    bookTitle: string
    author: string
    chapterTitle: string
    bookId?: string
    progress?: number
  },
): Promise<string> {
  return callAiCompanion('chapter_feature', { kind, ...input })
}

export async function getComprehensionQuiz(
  input: {
    bookTitle: string
    author: string
    chapterTitle: string
    bookId?: string
    progress?: number
  },
): Promise<QuizQuestion[]> {
  const raw = await getChapterFeature('quiz', input)
  let text = (raw ?? '').trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) text = fenced[1].trim()
  try {
    const parsed = JSON.parse(text)
    const items = (parsed?.questions ?? []) as QuizQuestion[]
    return items.filter(
      (q) =>
        q &&
        typeof q.q === 'string' &&
        Array.isArray(q.choices) &&
        q.choices.length === 4 &&
        typeof q.correctIndex === 'number',
    )
  } catch {
    return []
  }
}

// ── Word aspects (Phase B) ───────────────────────────────────────────────

export type WordAspect =
  | 'pronunciation'
  | 'etymology'
  | 'translation'
  | 'synonyms'
  | 'usage'
  | 'grammar'

export async function getWordAspect(
  aspect: WordAspect,
  input: {
    word: string
    sentence: string
    bookTitle: string
    author: string
    targetLanguage?: string
    bookId?: string
    currentChapter?: string
    progress?: number
  },
): Promise<string> {
  return callAiCompanion('word_aspect', { aspect, ...input })
}

// ── Bilingual paragraph translation (Phase I) ────────────────────────────

export async function getBilingualParagraphs(input: {
  paragraphs: string[]
  targetLanguage: string
  bookTitle: string
  author: string
  bookId?: string
  currentChapter?: string
}): Promise<string[]> {
  const raw = await callAiCompanion('bilingual_paragraph', input)
  let text = (raw ?? '').trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) text = fenced[1].trim()
  try {
    const parsed = JSON.parse(text)
    const arr = (parsed?.translations ?? []) as unknown[]
    return arr.filter((s): s is string => typeof s === 'string')
  } catch {
    return []
  }
}

// ── Language difficulty (Phase I), cached in book_ai_cache via book-ai. ──

export async function getLanguageDifficulty(input: {
  bookTitle: string
  author: string
  sampleText?: string
  bookId?: string
}): Promise<string> {
  return callAiCompanion('language_difficulty', input)
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

// Book-club discussion starter, returns a draft thread title + opening
// post pitched at the club's current chapter. The Edge Function must
// implement the 'discussion_starter' action and return JSON of shape
// `{ title: string, opening: string }`, if it returns plain text the
// client will fall back to using the whole string as the opening post.
export interface DiscussionStarterDraft {
  title: string
  opening: string
}

export async function getDiscussionStarter(input: {
  bookTitle: string
  author: string
  currentChapter?: string
  clubName?: string
  bookId?: string
  progress?: number
}): Promise<DiscussionStarterDraft> {
  const raw = await callAiCompanion('discussion_starter', {
    bookTitle: input.bookTitle,
    author: input.author,
    currentChapter: input.currentChapter ?? '',
    clubName: input.clubName ?? '',
    bookId: input.bookId,
    progress: input.progress,
  })
  // Try JSON first; fall back to plain text if Claude didn't comply.
  let text = (raw ?? '').trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) text = fenced[1].trim()
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed.title === 'string' && typeof parsed.opening === 'string') {
      return { title: parsed.title.trim(), opening: parsed.opening.trim() }
    }
  } catch {
    // fallthrough
  }
  return {
    title: `Discussion: ${input.currentChapter || input.bookTitle}`,
    opening: text || `What stood out to you in ${input.currentChapter || input.bookTitle}?`,
  }
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
