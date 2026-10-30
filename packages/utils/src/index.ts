// Shared utility functions used by both mobile and web. Add functions here
// as common patterns emerge.

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).trimEnd() + '...'
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
