import type { PillMode } from './floating-pill'
import { useColors } from '@/constants/colors'
import { BookmarkSimple, ChatCircle, Highlighter, type Icon, Lock, MagnifyingGlass, Translate, UsersThree, X as XIcon } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { Pressable, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'

// All-options bottom sheet shown on long-press of the pill. Mirrors the inline
// menu with full labels. Each action calls the handler the pill already wires.
export function AllOptionsSheet({
  visible,
  mode,
  showClub,
  locked,
  onUpgrade,
  onClose,
  onLookup,
  onAnalyze,
  onAsk,
  onTranslate,
  onClub,
  onHighlight,
  onSavePassage,
  onDismissAll,
}: {
  visible: boolean
  mode: PillMode
  showClub: boolean
  locked?: boolean
  onUpgrade?: (feature: string) => void
  onClose: () => void
  onLookup?: () => void
  onAnalyze?: () => void
  onAsk?: () => void
  onTranslate?: () => void
  onClub?: () => void
  onHighlight: () => void
  onSavePassage: () => void
  onDismissAll: () => void
}) {
  const colors = useColors()
  const items: Array<{
    key: string
    label: string
    Icon: Icon
    onPress: () => void
    destructive?: boolean
    gated?: boolean
  }> = []
  items.push({ key: 'highlight', label: 'Highlight', Icon: Highlighter, onPress: onHighlight })
  if (mode === 'word') {
    items.push({ key: 'lookup', label: 'Look up', Icon: MagnifyingGlass, onPress: () => onLookup?.(), gated: true })
    items.push({ key: 'translate', label: 'Translate', Icon: Translate, onPress: () => onTranslate?.(), gated: true })
    items.push({ key: 'ask', label: 'Ask', Icon: ChatCircle, onPress: () => onAsk?.(), gated: true })
  } else {
    items.push({ key: 'analyze', label: 'Analyze', Icon: MagnifyingGlass, onPress: () => onAnalyze?.(), gated: true })
    items.push({ key: 'ask', label: 'Ask', Icon: ChatCircle, onPress: () => onAsk?.(), gated: true })
    if (showClub) {
      items.push({ key: 'comment', label: 'Comment', Icon: UsersThree, onPress: () => onClub?.() })
    }
    items.push({ key: 'translate', label: 'Translate', Icon: Translate, onPress: () => onTranslate?.(), gated: true })
    items.push({ key: 'save', label: 'Save Passage', Icon: BookmarkSimple, onPress: onSavePassage })
  }
  items.push({ key: 'dismiss', label: 'Dismiss', Icon: XIcon, onPress: onDismissAll, destructive: true })

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          Actions
        </Text>
      }
    >
          {items.map((item, i) => {
            const isLocked = !!locked && !!item.gated
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onClose()
                  if (isLocked) {
                    onUpgrade?.(item.label)
                    return
                  }
                  item.onPress()
                }}
                accessibilityRole="button"
                accessibilityLabel={isLocked ? `${item.label}, Plus feature` : item.label}
                className="flex-row items-center px-5"
                style={{
                  minHeight: 56,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <item.Icon
                    color={item.destructive ? colors.error : colors.brandUi}
                    size={16}
                  />
                  {isLocked ? <LockBadge colors={colors} /> : null}
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 15,
                    color: item.destructive ? colors.error : colors.textPrimary,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
    </SheetScaffold>
  )
}

// One action chip inside the pill. The primary chip gets a brand-subtle bg and
// a label so the eye lands on it; secondary chips are icon-only (label exposed
// via accessibilityLabel) so the unified menu fits inline. autoFocus is
// iOS-only; safe to pass as a no-op elsewhere via the type cast.
export function PillAction({
  Icon,
  label,
  a11yLabel,
  onPress,
  primary,
  iconOnly,
  autoFocus,
  showLock,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: 'regular' | 'bold' | 'fill' }>
  label: string
  a11yLabel: string
  onPress: () => void
  primary?: boolean
  iconOnly?: boolean
  autoFocus?: boolean
  showLock?: boolean
}) {
  const colors = useColors()
  const ICON_SIZE = 18
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(autoFocus ? ({ accessibilityAutoFocus: true } as any) : {})}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: primary ? 12 : 8,
        paddingVertical: 8,
        marginVertical: 2,
        marginHorizontal: primary ? 2 : 0,
        borderRadius: 999,
        backgroundColor: primary ? colors.brandSubtle : 'transparent',
      }}
    >
      <View>
        <Icon color={primary ? colors.brandSubtleText : colors.brandText} size={ICON_SIZE} />
        {showLock ? <LockBadge colors={colors} /> : null}
      </View>
      {iconOnly ? null : (
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: primary ? colors.brandSubtleText : colors.textSecondary,
            marginLeft: 6,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

// Small lock badge overlaid on the top-right of a gated action's icon.
function LockBadge({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: -5,
        right: -7,
        width: 13,
        height: 13,
        borderRadius: 7,
        backgroundColor: colors.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Lock color={colors.brandText} size={9} weight="fill" />
    </View>
  )
}
