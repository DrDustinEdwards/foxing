import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native'
import { PencilSimple, Camera } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import type { EditableProfile } from '@/components/profile/edit-profile-sheet'

export function ProfileHeader({
  profile,
  initial,
  avatarBusy,
  onAvatarTap,
  onEdit,
}: {
  profile: EditableProfile | null
  initial: string
  avatarBusy: boolean
  onAvatarTap: () => void
  onEdit: () => void
}) {
  const colors = useColors()
  return (
    <View className="items-center mt-2 mb-6">
      <Pressable
        onPress={onAvatarTap}
        disabled={avatarBusy}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        accessibilityState={avatarBusy ? { busy: true } : undefined}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            overflow: 'hidden',
            backgroundColor: colors.brandSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.borderSubtle,
          }}
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: '100%', height: '100%' }}
              accessibilityRole="image"
              accessibilityLabel="Your profile photo"
            />
          ) : (
            <Text style={{ fontFamily: Fonts.display, fontSize: 30, color: colors.brandSubtleText }}>
              {initial}
            </Text>
          )}
          {avatarBusy ? (
            <View
              style={{
                position: 'absolute',
                inset: 0 as any,
                backgroundColor: colors.overlay,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color={colors.textOnBrand} />
            </View>
          ) : null}
        </View>
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.brandUi,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.bgBase,
          }}
        >
          <Camera color={colors.textOnBrand} size={14} />
        </View>
      </Pressable>

      <Text
        style={{
          fontFamily: Fonts.displayBold,
          fontSize: 22,
          color: colors.textPrimary,
          marginTop: 14,
        }}
      >
        {profile?.display_name ?? 'Reader'}
      </Text>
      <Text
        style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}
      >
        @{profile?.username ?? 'reader'}
      </Text>
      {profile?.bio ? (
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
        disabled={!profile}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        accessibilityState={!profile ? { disabled: true } : undefined}
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
