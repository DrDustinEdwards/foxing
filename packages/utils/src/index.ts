// Shared utility functions used by both mobile and web. Add functions here
// as common patterns emerge.

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).trimEnd() + '...'
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatRating(rating: number | null): string {
  if (rating === null) return ''
  return rating.toFixed(1)
}

export function bookshopUrl(title: string, author?: string): string {
  const query = author ? `${title} ${author}` : title
  return `https://bookshop.org/search?keywords=${encodeURIComponent(query)}`
}

export function worldcatUrl(title: string, author?: string): string {
  const query = author ? `${title} ${author}` : title
  return `https://www.worldcat.org/search?q=${encodeURIComponent(query)}`
}
