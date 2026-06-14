/**
 * AI intent layer -- entry point only, shipped behind a flag (default OFF).
 *
 * INTEGRATION SEAM. The command palette can route a natural-language query to
 * the AI experience when AI_SEARCH_ENABLED is on. Today the ONLY recommendation
 * backend is /api/find-next-book -> the `ai-companion` edge function, which takes
 * STRUCTURED input (mood[] / pace / era), is Plus-only and rate-limited, and
 * whose source is not in this repo. There is NO natural-language -> books
 * endpoint yet.
 *
 * So the minimal path: map the NL query to those structured params as best as a
 * keyword heuristic allows, and hand off to the existing wizard (prefilled via
 * URL). The full in-palette NL results + "because you read..." reasoning is
 * deferred to the D10-eval slice, when a real NL endpoint can be built against a
 * verifiable contract. That work also depends on the catalog being tagged
 * (themes / mood_tags are nearly empty -- see task-catalog-enrichment.md).
 *
 * The flag stays OFF until the D10 adversarial safety eval passes. Flip it on by
 * setting NEXT_PUBLIC_AI_SEARCH=1 (Vercel env), no code change required.
 */
import { MOODS, type Mood } from '@/lib/foxing'

export const AI_SEARCH_ENABLED = process.env.NEXT_PUBLIC_AI_SEARCH === '1'

export type FindNextBookPace = 'slow' | 'any' | 'fast'
export type FindNextBookEra = 'anytime' | 'pre-1900' | '1900-1950' | 'modern'

export interface FindNextBookParams {
  mood: Mood[]
  pace: FindNextBookPace
  era: FindNextBookEra
}

/** Extra keyword -> mood hints beyond the literal MOODS tokens. */
const MOOD_HINTS: Array<[RegExp, Mood]> = [
  [/\b(gothic|horror|scary|grim|bleak)\b/, 'dark'],
  [/\b(funny|humor|humour|comic|comedy)\b/, 'funny'],
  [/\b(romance|romantic|love story)\b/, 'romantic'],
  [/\b(sad|moving|poignant|tear)\b/, 'emotional'],
  [/\b(thriller|suspense|gripping)\b/, 'tense'],
  [/\b(mystery|detective|whodunit)\b/, 'mysterious'],
  [/\b(adventure|epic|quest)\b/, 'adventurous'],
  [/\b(uplifting|cozy|cosy|comfort)\b/, 'hopeful'],
]

/**
 * Best-effort heuristic mapping of a free-text query to the wizard's structured
 * params. Deliberately simple; the real NL parser is the D10-eval slice.
 */
export function mapQueryToFindNextBookParams(query: string): FindNextBookParams {
  const q = query.toLowerCase()

  const mood = new Set<Mood>()
  for (const m of MOODS) {
    if (q.includes(m)) mood.add(m)
  }
  for (const [re, m] of MOOD_HINTS) {
    if (re.test(q)) mood.add(m)
  }

  let pace: FindNextBookPace = 'any'
  if (/\b(fast|quick|page[-\s]?turner|fast[-\s]?paced|gripping)\b/.test(q)) {
    pace = 'fast'
  } else if (/\b(slow|slow[-\s]?burn|literary|meditative|dense)\b/.test(q)) {
    pace = 'slow'
  }

  let era: FindNextBookEra = 'anytime'
  if (/\b(modern|contemporary|recent|new)\b/.test(q)) {
    era = 'modern'
  } else if (/\b(victorian|19th|1800s|pre[-\s]?1900|classic|gothic)\b/.test(q)) {
    era = 'pre-1900'
  } else if (/\b(20th|mid[-\s]?century|1900s|1900[-\s]?1950)\b/.test(q)) {
    era = '1900-1950'
  }

  return { mood: [...mood], pace, era }
}

/** Build the prefilled /find-next-book href from a natural-language query. */
export function buildFindNextBookHref(query: string): string {
  const p = mapQueryToFindNextBookParams(query)
  const sp = new URLSearchParams()
  if (p.mood.length) sp.set('mood', p.mood.join(','))
  if (p.pace !== 'any') sp.set('pace', p.pace)
  if (p.era !== 'anytime') sp.set('era', p.era)
  const qs = sp.toString()
  return `/find-next-book${qs ? `?${qs}` : ''}`
}
