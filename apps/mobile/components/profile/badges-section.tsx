import { View, Text, ScrollView } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { badgeIcon } from '@/lib/badges'
import { Section } from '@/components/profile/profile-section'

type BadgeEntry = {
  earned_at: string
  badge: { slug: string; name: string; category: string | null } | null
}

export function BadgesSection({
  badges,
  onViewAll,
}: {
  badges: BadgeEntry[]
  onViewAll: () => void
}) {
  const colors = useColors()
  return (
    <Section title="Badges" actionLabel="View all" onAction={onViewAll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4, paddingRight: 8 }}
      >
        {badges
          .filter((b) => b.badge)
          .map((b) => {
            const Icon = badgeIcon(b.badge!.slug)
            return (
              <View
                key={b.badge!.slug}
                style={{
                  width: 84,
                  alignItems: 'center',
                  marginRight: 8,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brandSubtle,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <Icon color={colors.brandSubtleText} size={28} weight="regular" />
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 6,
                    textAlign: 'center',
                  }}
                  numberOfLines={2}
                >
                  {b.badge!.name}
                </Text>
              </View>
            )
          })}
      </ScrollView>
    </Section>
  )
}
