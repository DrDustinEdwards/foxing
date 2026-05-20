export type AuthorClaimStatus = 'pending' | 'verified' | 'rejected'

export interface AuthorClaim {
  id: string
  user_id: string
  author_name: string
  website_url: string | null
  contact_email: string
  status: AuthorClaimStatus
  verification_token: string | null
  created_at: string
  reviewed_at: string | null
}
