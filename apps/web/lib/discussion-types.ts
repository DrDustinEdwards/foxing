// Client-safe types and constants for the discussions feature.
// Has no server-only imports, so it can be pulled into "use client"
// components without breaking the client import chain.
//
// Server-only query functions live in @/lib/discussions and re-export
// the symbols from this file for backward compatibility with existing
// server-component imports.

export type DiscussionType =
  | 'general'
  | 'chapter'
  | 'prediction'
  | 'first_impressions'
  | 'deep_dive'
  | 'hot_take'
  | 'quote'
  | 'character'
  | 'theme'
  | 'questions'
  | 'wrap_up'

export const DISCUSSION_TYPES: Array<{ value: DiscussionType; label: string }> =
  [
    { value: 'general', label: 'General' },
    { value: 'chapter', label: 'Chapter discussion' },
    { value: 'prediction', label: 'Prediction' },
    { value: 'first_impressions', label: 'First impressions' },
    { value: 'deep_dive', label: 'Deep dive' },
    { value: 'hot_take', label: 'Hot take' },
    { value: 'quote', label: 'Quote' },
    { value: 'character', label: 'Character' },
    { value: 'theme', label: 'Theme' },
    { value: 'questions', label: 'Questions' },
    { value: 'wrap_up', label: 'Wrap-up' },
  ]

export const DISCUSSION_TYPE_CLASSES: Record<DiscussionType, string> = {
  general: 'bg-bg-sunken text-text-secondary',
  chapter: 'bg-hl-cobalt text-hl-cobalt-t',
  prediction: 'bg-hl-purple text-hl-purple-t',
  first_impressions: 'bg-hl-amber text-hl-amber-t',
  deep_dive: 'bg-hl-sage text-hl-sage-t',
  hot_take: 'bg-hl-auburn text-hl-auburn-t',
  quote: 'bg-hl-yellow text-hl-yellow-t',
  character: 'bg-hl-crimson text-hl-crimson-t',
  theme: 'bg-hl-cobalt text-hl-cobalt-t',
  questions: 'bg-hl-amber text-hl-amber-t',
  wrap_up: 'bg-hl-sage text-hl-sage-t',
}
