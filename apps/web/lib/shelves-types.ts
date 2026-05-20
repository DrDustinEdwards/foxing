export interface CustomShelfRow {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  position: number | null
  created_at: string
  updated_at: string
}

export interface ShelfBook {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
}

export interface CustomShelfWithCount extends CustomShelfRow {
  book_count: number
}

export interface CustomShelfWithBooks extends CustomShelfRow {
  books: ShelfBook[]
}
