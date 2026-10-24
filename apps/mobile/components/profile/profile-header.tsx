import type * as W from '@foxing/types'
import { View, Text, Pressable } from 'react-native'
import { PencilSimple } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Avatar } from '@/components/feed/feed-row'

export function ProfileHeader({ profile, onEdit }: { profile: W.MyProfile; onEdit: () => void }) {
  const colors = useColors()
  return (
    <View className="items-center mt-2 mb-6">
      <Avatar profile={profile} size={80} />
      <Text style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary, marginTop: 14 }}>
        {profile.displayName ?? profile.username}
      </Text>
      <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
        @{profile.username}
      </Text>
      {profile.bio ? (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 10,
            textAlign: 'center',
            lineHeight: 20,
            paddingHorizontal: 16,
          }}
        >
          {profile.bio}
        </Text>
      ) : null}

      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        className="mt-4 flex-row items-center gap-2 px-4 py-2 rounded-full border border-border-interactive-light dark:border-border-interactive-dark bg-bg-surface-light dark:bg-bg-surface-dark"
      >
        <PencilSimple color={colors.textPrimary} size={14} />
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
          Edit Profile
        </Text>
      </Pressable>
    </View>
  )
}
