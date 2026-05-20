export interface AuthorQuestion {
  id: string
  asker_id: string
  author_user_id: string
  question: string
  answer: string | null
  is_public: boolean
  created_at: string
  answered_at: string | null
}

export interface AuthorQuestionWithMeta extends AuthorQuestion {
  asker: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  upvote_count: number
  viewer_upvoted: boolean
}
