export type GiveawayKind = 'digital' | 'physical'

export interface Giveaway {
  id: string
  author_user_id: string
  title: string
  description: string | null
  book_id: string | null
  kind: GiveawayKind
  prize_count: number
  deadline: string
  winner_picked_at: string | null
  created_at: string
}

export interface GiveawayWithMeta extends Giveaway {
  entry_count: number
  viewer_entered: boolean
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
  author: {
    username: string
    display_name: string
  } | null
}
