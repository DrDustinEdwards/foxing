/**
 * Shared constants and tiny helpers used across the web platform.
 * Anything that's reused on more than one page lives here.
 */

export const FOXING_APP_DEEPLINK_PREFIX = 'foxing://'

export function appBookDeeplink(bookId: string): string {
  return `${FOXING_APP_DEEPLINK_PREFIX}book/${bookId}`
}

export function appClubDeeplink(clubId: string): string {
  return `${FOXING_APP_DEEPLINK_PREFIX}clubs/${clubId}`
}

export const MOODS = [
  'dark',
  'lighthearted',
  'emotional',
  'tense',
  'hopeful',
  'funny',
  'mysterious',
  'adventurous',
  'reflective',
  'romantic',
] as const

export type Mood = (typeof MOODS)[number]

export const ERAS = [
  { value: 'pre-1800', label: 'Pre-1800' },
  { value: '1800s', label: '1800s' },
  { value: 'early-1900s', label: 'Early 1900s' },
  { value: 'mid-1900s', label: 'Mid 1900s' },
] as const

export const LENGTHS = [
  { value: 'short', label: 'Short (under 200 pages)' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
] as const

/**
 * Day of year, 1..366, used to seed the rotating Today's Pick.
 * Computed in UTC so it doesn't shift mid-day for users in different zones.
 */
export function dayOfYear(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const now = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  return Math.floor((now - start) / 86_400_000)
}

/**
 * Returns the absolute origin for canonical URLs and og:image links.
 * Vercel injects VERCEL_URL on production builds. NEXT_PUBLIC_SITE_URL is
 * the override for local dev and custom domains.
 */
export function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/**
 * Word count thresholds, used to bucket books by length when the `length`
 * query param is supplied. The numbers are intentionally rough.
 */
export const LENGTH_BUCKETS = {
  short: { max: 60_000 },
  medium: { min: 60_000, max: 120_000 },
  long: { min: 120_000 },
} as const

/**
 * Strip leading "The", "A", "An" for sortable title strings.
 */
export function titleSortKey(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '').toLowerCase()
}
