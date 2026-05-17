const COVERS_BASE = 'https://covers.openlibrary.org/b'

export function getCoverByISBN(isbn: string, size: 'S' | 'M' | 'L' = 'L'): string {
  return `${COVERS_BASE}/isbn/${isbn}-${size}.jpg`
}

export function getCoverByOLID(olid: string, size: 'S' | 'M' | 'L' = 'L'): string {
  return `${COVERS_BASE}/olid/${olid}-${size}.jpg`
}

export async function searchOpenLibrary(query: string) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`
  const response = await fetch(url)
  return response.json()
}
