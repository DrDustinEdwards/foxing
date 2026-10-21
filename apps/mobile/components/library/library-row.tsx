import type { BookRow } from '@/components/library/library-types'
import { useColors } from '@/constants/colors'
import { Image, Pressable, Text, View } from 'react-native'
import { ArrowClockwise, Check, Pause, Play, Star, StarHalf } from 'phosphor-react-native'
import { Fonts } from '@/constants/fonts'

export function LibraryRow({
  row,
  showRating,
  editMode,
  selected,
  onToggleSelect,
  onOpen,
  onLongPress,
  onRatingChange,
  onReview,
  onReread,
  onResume,
}: {
  row: BookRow
  showRating: boolean
  editMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onLongPress?: () => void
  onRatingChange: (rating: number) => void
  onReview: () => void
  onReread: () => void
  onResume: () => void
}) {
  const colors = useColors()
  const book = row.book
  return (
    <Pressable
      onPress={editMode ? onToggleSelect : onOpen}
      onLongPress={editMode ? undefined : onLongPress}
      delayLongPress={400}
      accessibilityRole={editMode ? 'checkbox' : 'button'}
      accessibilityState={editMode ? { checked: selected } : undefined}
      accessibilityLabel={
        editMode
          ? `${selected ? 'Deselect' : 'Select'} ${book?.title ?? 'book'}`
          : `Open ${book?.title ?? 'book'}`
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
        {book?.cover_url ? (
          <Image
            source={{ uri: book.cover_url }}
            style={{ width: '100%', height: '100%' }}
            accessibilityRole="image"
            accessibilityLabel={`${book?.title ?? 'Book'} cover`}
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
          {book?.title ?? ''}
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
          {book?.author ?? ''}
        </Text>
        {book?.series_name ? (
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 10,
              color: colors.brandText,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {book.series_name}
          </Text>
        ) : null}
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
                now: Math.round(row.progress_percentage * 100),
              }}
            >
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.brandUi,
                  width: `${Math.max(0, Math.min(100, row.progress_percentage * 100))}%`,
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
              {Math.round(row.progress_percentage * 100)}%
            </Text>
          </View>
        ) : null}
        {showRating ? (
          <View style={{ marginTop: 8 }}>
            <Stars value={row.rating_half ?? row.rating ?? 0} onChange={onRatingChange} />
            <View className="flex-row items-center gap-3" style={{ marginTop: 6 }}>
              <Pressable onPress={onReview} hitSlop={4}>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}
                >
                  {row.review ? 'Edit review' : 'Write review'}
                </Text>
              </Pressable>
              <Pressable onPress={onReread} hitSlop={4} className="flex-row items-center gap-1">
                <ArrowClockwise color={colors.brandText} size={11} />
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}
                >
                  Read again
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

// Renders 5 stars with half-star awareness. Each star has two tap zones.
// left half sets X.5, right half sets X. Tapping the currently-selected
// value clears the rating to 0. value is a 0..5 half-step float.
function Stars({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const colors = useColors()
  const STAR_SIZE = 18
  return (
    <View
      className="flex-row"
      style={{ gap: 2 }}
      accessibilityRole="radiogroup"
      accessibilityLabel={`Rating, ${value} of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n
        const half = !filled && value >= n - 0.5
        const Icon = filled ? Star : half ? StarHalf : Star
        const iconColor = filled || half ? colors.brandSecondary : colors.textTertiary
        const weight = filled || half ? 'fill' : 'regular'
        return (
          <View key={n} style={{ flexDirection: 'row', position: 'relative' }}>
            {/* Left tap zone, sets X.5 */}
            <Pressable
              onPress={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
              hitSlop={2}
              accessibilityRole="radio"
              accessibilityLabel={`${n - 0.5} stars`}
              accessibilityState={{ selected: half }}
              style={{ width: STAR_SIZE / 2, height: STAR_SIZE, zIndex: 1 }}
            />
            {/* Right tap zone, sets X */}
            <Pressable
              onPress={() => onChange(value === n ? 0 : n)}
              hitSlop={2}
              accessibilityRole="radio"
              accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ selected: filled }}
              style={{ width: STAR_SIZE / 2, height: STAR_SIZE, zIndex: 1 }}
            />
            {/* Star icon, rendered behind the tap zones so the visible star
                doesn't intercept presses meant for the half-zones. */}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, width: STAR_SIZE, height: STAR_SIZE }}
            >
              <Icon color={iconColor} weight={weight} size={STAR_SIZE} />
            </View>
          </View>
        )
      })}
    </View>
  )
}
