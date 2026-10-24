// Format a timestamp as "5m ago", "yesterday", "Mar 5". Locale-aware
// for older dates only, the bucketed labels read the same in every locale.
export function relativeTime(at: string | number): string {
  const now = Date.now()
  const t = new Date(at).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.max(0, Math.floor((now - t) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day}d ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
