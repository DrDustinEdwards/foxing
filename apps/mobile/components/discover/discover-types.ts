

export interface SupaBook {
  id: string
  title: string
  author: string
  cover_url: string | null
  epub_url?: string | null
}

export interface ClubLite {
  id: string
  name: string
  member_count: number
  current_book_id: string | null
  current_book: SupaBook | null
}
