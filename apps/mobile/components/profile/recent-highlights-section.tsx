import { View, Text } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Section } from '@/components/profile/profile-section'

type RecentHighlight = {
  id: string
  text: string
  color: string | null
  created_at: string
  book: { id: string; title: string; author: string } | null
}

export function RecentHighlightsSection({
  highlights,
  onViewAll,
}: {
  highlights: RecentHighlight[]
  onViewAll: () => void
}) {
  const colors = useColors()
  return (
    <Section title="Recent Highlights" actionLabel="View all" onAction={onViewAll}>
      {highlights.map((h) => (
        <View
          key={h.id}
          className="mb-2 rounded-2xl p-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        >
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
              lineHeight: 21,
            }}
            numberOfLines={3}
          >
            “{h.text}”
          </Text>
          {h.book ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 6,
              }}
              numberOfLines={1}
            >
              {h.book.title} · {h.book.author}
            </Text>
          ) : null}
        </View>
      ))}
    </Section>
  )
}
