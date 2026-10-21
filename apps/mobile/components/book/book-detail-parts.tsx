import { useColors } from '@/constants/colors'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { useState } from 'react'

export function SecondaryButton({
  Icon,
  label,
  onPress,
  active,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'fill' }>
  label: string
  onPress: () => void
  active?: boolean
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      className="items-center"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active ? { selected: true } : undefined}
    >
      <Icon
        color={active ? colors.brandUi : colors.textSecondary}
        size={18}
        weight={active ? 'fill' : 'regular'}
      />
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: active ? colors.brandText : colors.textSecondary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 11,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 22,
        marginBottom: 10,
        paddingHorizontal: 20,
      }}
    >
      {children}
    </Text>
  )
}

export function ExpandableText({ text }: { text: string }) {
  const colors = useColors()
  const [expanded, setExpanded] = useState(false)
  if (!text) {
    return (
      <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
        A classic work from the public domain.
      </Text>
    )
  }
  return (
    <View>
      <Text
        style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 }}
        numberOfLines={expanded ? undefined : 4}
      >
        {text}
      </Text>
      {text.length > 220 ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={4}>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText, marginTop: 4 }}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function NoteInput({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (v: string) => void
}) {
  const colors = useColors()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Add a note (optional)"
      placeholderTextColor={colors.textTertiary}
      multiline
      style={{
        fontFamily: Fonts.body,
        fontSize: 14,
        color: colors.textPrimary,
        backgroundColor: colors.bgBase,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 60,
      }}
    />
  )
}
