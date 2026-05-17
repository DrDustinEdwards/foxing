import type { ComponentType } from 'react'
import {
  BookOpen,
  Highlighter,
  Compass,
  Buildings,
  UsersThree,
  ChatCircleText,
  Star,
  Crown,
  Flame,
  MoonStars,
  Lightning,
  Trophy,
  Books,
  BookmarkSimple,
  Trophy as TrophyIcon,
} from 'phosphor-react-native'

export type PhosphorIcon = ComponentType<{
  color?: string
  size?: number
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
}>

export interface BadgeRow {
  id?: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  category: 'reading' | 'social' | 'streak' | 'club' | 'milestone' | string | null
}

const ICONS: Record<string, PhosphorIcon> = {
  first_book: BookOpen,
  first_highlight: Highlighter,
  genre_explorer: Compass,
  hundred_books: TrophyIcon,
  night_owl: MoonStars,
  speed_reader: Lightning,
  ten_books: Books,
  hundred_highlights: BookmarkSimple,
  club_founder: Buildings,
  first_club: UsersThree,
  first_discussion: ChatCircleText,
  helpful_commenter: Star,
  week_streak: Flame,
  month_streak: Flame,
  year_streak: Crown,
}

export function badgeIcon(slug: string): PhosphorIcon {
  return ICONS[slug] ?? Trophy
}
