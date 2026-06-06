export const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function formatLongDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString()
}
