import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { X as XIcon, CaretRight, CaretLeft, Star, StarHalf } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useCreateDiaryEntry } from '@foxing/client'
import { queueWrite } from '@/lib/api'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Post-finish review sheet, two pages. Page 1 is rating + review, saved as a
// diary entry; Page 2 collects optional mood tags for the book on the shelf.
// Skip is always available on Page 2.

interface FinishReviewSheetProps {
  visible: boolean
  bookId: string
  bookTitle: string
  onClose: () => void
  onSaved?: () => void
}

const MOOD_CHIPS = [
  'dark',
  'lighthearted',
  'emotional',
  'tense',
  'hopeful',
  'funny',
  'mysterious',
  'adventurous',
  'reflective',
  'romantic',
] as const

type Mood = (typeof MOOD_CHIPS)[number]
export function FinishReviewSheet({
  visible,
  bookId,
  bookTitle,
  onClose,
  onSaved,
}: FinishReviewSheetProps) {
  const colors = useColors()
  const [page, setPage] = useState<1 | 2>(1)
  const [rating, setRating] = useState(0) // 0..5 in half-steps
  const [review, setReview] = useState('')
  const [longForm, setLongForm] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [moods, setMoods] = useState<Set<Mood>>(new Set())
  const diary = useCreateDiaryEntry()
  const saving = diary.pending

  useEffect(() => {
    if (!visible) return
    setPage(1)
    setRating(0)
    setReview('')
    setLongForm(false)
    setIsPublic(true)
    setMoods(new Set())
  }, [visible])

  // Rating is 0..5 in half steps; the diary stores half stars, 1..10.
  const savePage1 = useCallback(async () => {
    if (rating === 0 && !review.trim()) return
    await diary.run({
      bookId,
      ratingHalf: rating === 0 ? null : Math.round(rating * 2),
      review: review.trim() || null,
      visibility: isPublic ? 'public' : 'private',
    })
  }, [bookId, diary, isPublic, rating, review])

  const savePage2 = useCallback(async () => {
    if (moods.size === 0) return
    await queueWrite({ resource: 'user_book', verb: 'update', payload: { bookId, moodTags: [...moods] } })
  }, [bookId, moods])

  const onNext = useCallback(async () => {
    await savePage1()
    setPage(2)
  }, [savePage1])

  const onDone = useCallback(async () => {
    if (page === 1) {
      await savePage1()
    } else {
      await savePage2()
    }
    onSaved?.()
    onClose()
  }, [onClose, onSaved, page, savePage1, savePage2])

  const onSkip = useCallback(() => {
    onSaved?.()
    onClose()
  }, [onClose, onSaved])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <>
          <View className="flex-row items-center justify-between px-3 py-2">
            <Pressable
              onPress={page === 2 ? () => setPage(1) : onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={page === 2 ? 'Back to rating' : 'Close'}
              className="p-2"
            >
              {page === 2 ? (
                <CaretLeft color={colors.textPrimary} size={20} />
              ) : (
                <XIcon color={colors.textPrimary} size={20} />
              )}
            </Pressable>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}
              numberOfLines={1}
            >
              How was {bookTitle}?
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <View className="flex-row gap-1 px-4 mb-2">
            {[1, 2].map((p) => (
              <View
                key={p}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: p <= page ? colors.brandUi : colors.borderSubtle,
                }}
              />
            ))}
          </View>
        </>
      }
      footer={
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip remaining steps"
            className="px-4 py-2"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textTertiary, fontSize: 13 }}>
              Skip
            </Text>
          </Pressable>
          {page === 1 ? (
            <View className="flex-row gap-3">
              <Pressable
                onPress={onDone}
                accessibilityRole="button"
                accessibilityLabel="Done with review"
                disabled={saving}
                className="flex-row items-center gap-1 px-4 py-2 rounded-full border"
                style={{
                  borderColor: colors.borderInteractive,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                  Done
                </Text>
              </Pressable>
              <Pressable
                onPress={onNext}
                accessibilityRole="button"
                accessibilityLabel="Continue to tags"
                disabled={saving}
                className="flex-row items-center gap-1 px-5 py-2 rounded-full"
                style={{
                  backgroundColor: colors.brandUi,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnBrand} size="small" />
                ) : (
                  <>
                    <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                      Next
                    </Text>
                    <CaretRight color={colors.textOnBrand} size={14} weight="bold" />
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Save tags and finish"
              disabled={saving}
              className="px-5 py-2 rounded-full"
              style={{
                backgroundColor: colors.brandUi,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnBrand} size="small" />
              ) : (
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                  Done
                </Text>
              )}
            </Pressable>
          )}
        </View>
      }
    >
        {page === 1 ? (
          <>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Your rating
            </Text>
            <HalfStarRow value={rating} onChange={setRating} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary, marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Quick review
            </Text>
            <TextInput
              value={review}
              onChangeText={(t) => setReview(longForm ? t : t.slice(0, 140))}
              placeholder={longForm ? 'Write as much as you like…' : 'A line or two (140 chars)'}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={longForm ? undefined : 140}
              accessibilityLabel="Review text"
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                minHeight: longForm ? 200 : 90,
                textAlignVertical: 'top',
              }}
            />
            <View className="flex-row items-center justify-between" style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}>
                {longForm ? `${review.length} chars` : `${review.length}/140`}
              </Text>
              <Pressable
                onPress={() => setLongForm((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={longForm ? 'Switch to short review' : 'Write more'}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
                  {longForm ? 'Short review' : 'Write more'}
                </Text>
              </Pressable>
            </View>

            <View
              className="flex-row items-center justify-between mt-5 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                Public on my profile
              </Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              How did it feel?
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {MOOD_CHIPS.map((m) => {
                const active = moods.has(m)
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMoods((prev) => {
                        const next = new Set(prev)
                        if (next.has(m)) next.delete(m)
                        else next.add(m)
                        return next
                      })
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={m}
                    className="px-3 py-2 rounded-full border"
                    style={{
                      backgroundColor: active ? colors.brandSubtle : colors.bgSurface,
                      borderColor: active ? colors.borderBrand : colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 12,
                        color: active ? colors.brandSubtleText : colors.textSecondary,
                      }}
                    >
                      {m}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

          </>
        )}
    </SheetScaffold>
  )
}

// Same half-star tap zones as the library Stars component, sized up for the
// finish-review experience.
function HalfStarRow({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const colors = useColors()
  const SIZE = 32
  return (
    <View
      className="flex-row"
      style={{ gap: 4 }}
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
            <Pressable
              onPress={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`${n - 0.5} stars`}
              accessibilityState={{ selected: half }}
              style={{ width: SIZE / 2, height: SIZE, zIndex: 1 }}
            />
            <Pressable
              onPress={() => onChange(value === n ? 0 : n)}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ selected: filled }}
              style={{ width: SIZE / 2, height: SIZE, zIndex: 1 }}
            />
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE }}
            >
              <Icon color={iconColor} weight={weight} size={SIZE} />
            </View>
          </View>
        )
      })}
    </View>
  )
}
