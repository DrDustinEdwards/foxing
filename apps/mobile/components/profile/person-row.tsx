import { Pressable, Text, View } from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Avatar } from '@/components/feed/feed-row'

// One reader in a people list, with an optional action on the right.
export function PersonRow({
  person,
  onPress,
  action,
}: {
  person: { username: string; displayName: string | null; avatarUrl?: string | null }
  onPress: () => void
  action?: React.ReactNode
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`Open ${person.displayName ?? person.username} profile`}
      className="flex-row items-center py-3 px-3 mb-2 rounded-xl bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Avatar profile={{ avatarUrl: person.avatarUrl ?? null, ...person }} size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>
          {person.displayName ?? person.username}
        </Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>
          @{person.username}
        </Text>
      </View>
      {action}
    </Pressable>
  )
}
