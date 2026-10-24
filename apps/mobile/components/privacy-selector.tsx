import { View, Text, Pressable } from 'react-native'
import { Globe, UsersThree, Lock } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Three-tier privacy selector used by review composer, highlight save flow,
// chapter reactions, etc. Stored value is one of: 'public' | 'close_friends'
// | 'private'. Callers translate to their own storage shape (e.g. highlights
// uses is_public BOOLEAN, see HighlightsSheet wiring).

export type PrivacyTier = 'public' | 'close_friends' | 'private'

interface PrivacySelectorProps {
  value: PrivacyTier
  onChange: (next: PrivacyTier) => void
  // Optional dense layout, smaller pills for inline placement inside sheets.
  dense?: boolean
}

const OPTIONS: Array<{
  id: PrivacyTier
  label: string
  Icon: React.ComponentType<{ color: string; size: number }>
}> = [
  { id: 'public', label: 'Public', Icon: Globe },
  { id: 'close_friends', label: 'Close Friends', Icon: UsersThree },
  { id: 'private', label: 'Private', Icon: Lock },
]

export function PrivacySelector({ value, onChange, dense }: PrivacySelectorProps) {
  const colors = useColors()
  const padY = dense ? 6 : 8
  const padX = dense ? 10 : 14
  const fontSize = dense ? 12 : 13
  return (
    <View
      className="flex-row"
      style={{ gap: 6 }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Privacy"
    >
      {OPTIONS.map((o) => {
        const active = o.id === value
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            className="flex-1 flex-row items-center justify-center rounded-full border"
            style={{
              paddingVertical: padY,
              paddingHorizontal: padX,
              backgroundColor: active ? colors.bgSelected : colors.bgSurface,
              borderColor: active ? colors.borderBrand : colors.borderSubtle,
              gap: 6,
            }}
          >
            <o.Icon color={active ? colors.brandText : colors.textSecondary} size={dense ? 13 : 14} />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize,
                color: active ? colors.brandText : colors.textSecondary,
              }}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// The three-tier picker as an annotation's audience on the server.
export function privacyToVisibility(tier: PrivacyTier): 'public' | 'friends' | 'private' {
  return tier === 'close_friends' ? 'friends' : tier
}
