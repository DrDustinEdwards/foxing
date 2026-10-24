import type { BookRow } from '@/components/library/library-types'
import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { ArrowClockwise, Check, Pause, Play } from 'phosphor-react-native'
import { Fonts } from '@/constants/fonts'

export function LibraryRow({
  row,
  editMode,
  selected,
  onToggleSelect,
  onOpen,
  onLongPress,
  onReread,
  onResume,
}: {
  row: BookRow
  editMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onLongPress?: () => void
  onReread: () => void
  onResume: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={editMode ? onToggleSelect : onOpen}
      onLongPress={editMode ? undefined : onLongPress}
      delayLongPress={400}
      accessibilityRole={editMode ? 'checkbox' : 'button'}
      accessibilityState={editMode ? { checked: selected } : undefined}
      accessibilityLabel={
        editMode
          ? `${selected ? 'Deselect' : 'Select'} ${row.title}`
          : `Open ${row.title}`
      }
      className="flex-row mb-4 rounded-xl p-3 bg-bg-surface-light dark:bg-bg-surface-dark border border-border-subtle-light dark:border-border-subtle-dark"
      style={
        editMode && selected
          ? { borderColor: colors.borderBrand, backgroundColor: colors.bgSelected }
          : undefined
      }
    >
      {editMode ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? colors.brandUi : colors.borderInteractive,
            backgroundColor: selected ? colors.brandUi : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
            alignSelf: 'center',
          }}
        >
          {selected ? <Check color={colors.textOnBrand} size={12} weight="bold" /> : null}
        </View>
      ) : null}
      <View
        style={{
          width: 60,
          height: 90,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: colors.bgSunken,
          marginRight: 12,
        }}
      >
        {row.coverUrl ? (
          <Image
            source={{ uri: row.coverUrl }}
            style={{ width: '100%', height: '100%' }}
            accessibilityRole="image"
            accessibilityLabel={`${row.title} cover`}
          />
        ) : null}
        {row.status === 'paused' ? (
          <View
            style={{
              position: 'absolute',
              inset: 0 as never,
              backgroundColor: colors.scrimLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Paused"
          >
            <Pause color={colors.textOnDark} size={20} weight="fill" />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
          numberOfLines={2}
        >
          {row.title}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 12,
            color: colors.textTertiary,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {row.author}
        </Text>
        {row.status === 'paused' ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onResume()
            }}
            accessibilityRole="button"
            accessibilityLabel="Resume reading"
            className="flex-row items-center self-start mt-2 px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.brandUi, gap: 4 }}
          >
            <Play color={colors.textOnBrand} size={11} weight="fill" />
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textOnBrand }}
            >
              Resume
            </Text>
          </Pressable>
        ) : null}
        {row.status === 'reading' ? (
          <View style={{ marginTop: 8 }}>
            <View
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.bgSunken,
              }}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(row.progressPct),
              }}
            >
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.brandUi,
                  width: `${Math.max(0, Math.min(100, row.progressPct))}%`,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 4,
              }}
            >
              {Math.round(row.progressPct)}%
            </Text>
          </View>
        ) : null}
        {row.status === 'finished' && !editMode ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onReread()
            }}
            hitSlop={4}
            accessibilityRole="button"
            className="flex-row items-center self-start mt-2 gap-1"
          >
            <ArrowClockwise color={colors.brandText} size={11} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}>
              Read again
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  )
}
