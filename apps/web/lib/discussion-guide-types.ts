export interface DiscussionQuestion {
  question: string
  theme?: string
}

export interface DiscussionGuide {
  id: string
  book_id: string
  questions: DiscussionQuestion[]
  generated_at: string
  model: string
}
