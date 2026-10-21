import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type { BookHit, ClubHit, ProfileHit, ThreadHit } from './search-types'
import { BookOpen, ChatCircleText, Plus, UserPlus, UsersThree } from 'phosphor-react-native'

export function ResultsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginTop: 12 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

export function BookResult({
  hit,
  onPress,
  onAdd,
}: {
  hit: BookHit
  onPress: () => void
  onAdd: () => void
}) {
  const colors = useColors()
  const subj = (hit.subjects ?? [])[0]?.split(/[\u2014\u2013\-:]/)[0].trim().slice(0, 28)
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center p-2 mb-1 rounded-xl"
    >
      <View
        style={{
          width: 40,
          height: 56,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: colors.bgSunken,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {hit.cover_url ? (
          <Image source={{ uri: hit.cover_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <BookOpen color={colors.textTertiary} size={16} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {hit.title}
        </Text>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary }}
          numberOfLines={1}
        >
          {hit.author}
          {subj ? ` · ${subj}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onAdd}
        hitSlop={6}
        className="px-3 py-1 rounded-full"
        style={{ backgroundColor: colors.brandSubtle }}
      >
        <Plus color={colors.brandSubtleText} size={12} weight="bold" />
      </Pressable>
    </Pressable>
  )
}

export function PersonResult({
  hit,
  onPress,
}: {
  hit: ProfileHit
  onPress: () => void
}) {
  const colors = useColors()
  const initial = (hit.display_name || hit.username || '?')[0]?.toUpperCase() ?? '?'
  return (
    <Pressable onPress={onPress} className="flex-row items-center p-2 mb-1 rounded-xl">
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {hit.avatar_url ? (
          <Image source={{ uri: hit.avatar_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontFamily: Fonts.display, fontSize: 14, color: colors.brandSubtleText }}>
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {hit.display_name ?? hit.username ?? 'Reader'}
        </Text>
        <Text
          style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}
          numberOfLines={1}
        >
          @{hit.username ?? 'reader'}
        </Text>
      </View>
      <UserPlus color={colors.brandText} size={14} />
    </Pressable>
  )
}

export function ClubResult({
  hit,
  onPress,
  onJoin,
}: {
  hit: ClubHit
  onPress: () => void
  onJoin: () => void
}) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} className="flex-row items-center p-2 mb-1 rounded-xl">
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <UsersThree color={colors.brandSubtleText} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {hit.name}
        </Text>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
          numberOfLines={1}
        >
          {hit.member_count} member{hit.member_count === 1 ? '' : 's'}
          {hit.current_book?.title ? ` · ${hit.current_book.title}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onJoin}
        hitSlop={6}
        className="px-3 py-1 rounded-full"
        style={{ backgroundColor: colors.brandUi }}
      >
        <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 11 }}>
          Join
        </Text>
      </Pressable>
    </Pressable>
  )
}

export function ThreadResult({ hit, onPress }: { hit: ThreadHit; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} className="flex-row items-center p-2 mb-1 rounded-xl">
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <ChatCircleText color={colors.brandSubtleText} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {hit.title}
        </Text>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
          numberOfLines={1}
        >
          {hit.club?.name ?? 'Club'} · {hit.post_count} post{hit.post_count === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  )
}
