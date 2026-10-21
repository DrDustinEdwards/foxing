

export interface BookHit {
  id: string
  title: string
  author: string
  cover_url: string | null
  subjects: string[] | null
}

export interface ProfileHit {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export interface ClubHit {
  id: string
  name: string
  member_count: number
  current_book: { title: string } | null
}

export interface ThreadHit {
  id: string
  title: string
  club_id: string
  post_count: number
  club: { name: string } | null
}
