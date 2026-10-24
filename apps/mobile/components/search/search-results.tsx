import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type * as W from '@foxing/types'
import { BookOpen, Plus, User, UserPlus, UsersThree } from 'phosphor-react-native'

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
  hit: W.BookCard
  onPress: () => void
  onAdd: () => void
}) {
  const colors = useColors()
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
        {hit.coverUrl ? (
          <Image source={{ uri: hit.coverUrl }} style={{ width: '100%', height: '100%' }} />
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
          {hit.publicationYear ? ` · ${hit.publicationYear}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onAdd}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${hit.title} to Want to Read`}
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
  hit: W.SearchSuggest['people'][number]
  onPress: () => void
}) {
  const colors = useColors()
  const initial = (hit.displayName || hit.username || '?')[0]?.toUpperCase() ?? '?'
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
        <Text style={{ fontFamily: Fonts.display, fontSize: 14, color: colors.brandSubtleText }}>
          {initial}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {hit.displayName}
        </Text>
        <Text
          style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}
          numberOfLines={1}
        >
          @{hit.username}
        </Text>
      </View>
      <UserPlus color={colors.brandText} size={14} />
    </Pressable>
  )
}

export function ClubResult({ hit, onPress }: { hit: W.SearchSuggest['clubs'][number]; onPress: () => void }) {
  return <IconResult Icon={UsersThree} title={hit.name} subtitle="Book club" onPress={onPress} />
}

export function AuthorResult({
  hit,
  onPress,
}: {
  hit: W.SearchPage['authors'][number]
  onPress: () => void
}) {
  return (
    <IconResult
      Icon={User}
      title={hit.name}
      subtitle={`${hit.bookCount} book${hit.bookCount === 1 ? '' : 's'}`}
      onPress={onPress}
    />
  )
}

function IconResult({
  Icon,
  title,
  subtitle,
  onPress,
}: {
  Icon: typeof User
  title: string
  subtitle: string
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="flex-row items-center p-2 mb-1 rounded-xl">
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
        <Icon color={colors.brandSubtleText} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}
