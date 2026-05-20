export interface MenuStats {
  booksThisYear: number
  currentStreak: number
  totalHighlights: number
  goalTarget: number | null
  goalProgress: number
  freezeCredits: number
  vocabularyTotal: number
  vocabularyUnmastered: number
}

export interface UserHighlight {
  id: string
  text: string
  note: string | null
  color: string | null
  chapter: string | null
  is_public: boolean
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}
