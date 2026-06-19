import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { X as XIcon, Sparkle, ArrowsClockwise } from 'phosphor-react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { friendlyAiError, getDiscussionStarter } from '@/lib/claude'
import { createThread } from '@/lib/clubs'

interface DiscussionStarterSheetProps {
  visible: boolean
  clubId: string
  clubName: string
  bookTitle: string | null
  author: string | null
  currentChapter: string | null
  bookId: string | null
  onClose: () => void
  onPosted?: (threadId: string) => void
}

export function DiscussionStarterSheet({
  visible,
  clubId,
  clubName,
  bookTitle,
  author,
  currentChapter,
  bookId,
  onClose,
  onPosted,
}: DiscussionStarterSheetProps) {
  const colors = useColors()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [opening, setOpening] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [posting, setPosting] = useState(false)

  // Auto-generate a draft as soon as the sheet opens. The user can re-roll
  // or edit before posting; we never auto-post.
  const generate = useCallback(async () => {
    if (!bookTitle || !author) {
      setError('Set a current book on the club before generating a starter.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const draft = await getDiscussionStarter({
        bookTitle,
        author,
        currentChapter: currentChapter ?? undefined,
        clubName,
        bookId: bookId ?? undefined,
      })
      setTitle(draft.title)
      setOpening(draft.opening)
    } catch (e) {
      const msg = friendlyAiError(e)
      // Most likely: Edge Function doesn't implement `discussion_starter`
      // yet. Tell the user but leave the form usable for a manual post.
      setError(`${msg}. You can still write your own starter below.`)
      setTitle((t) => t || `Discussion: ${currentChapter || bookTitle}`)
      setOpening((o) => o || '')
    } finally {
      setGenerating(false)
    }
  }, [author, bookId, bookTitle, clubName, currentChapter])

  useEffect(() => {
    if (visible) {
      setTitle('')
      setOpening('')
      setHasSpoilers(false)
      setError(null)
      setPosting(false)
      generate()
    }
  }, [visible, generate])

  const post = useCallback(async () => {
    if (!title.trim() || !opening.trim() || posting) return
    setPosting(true)
    const thread = await createThread({
      clubId,
      title: title.trim(),
      chapter: currentChapter ?? null,
      openingPost: opening.trim(),
      hasSpoilers,
    })
    setPosting(false)
    if (thread) {
      onPosted?.(thread.id)
      onClose()
    } else {
      setError("Couldn't post the thread. Check that you're a member.")
    }
  }, [clubId, currentChapter, hasSpoilers, onClose, onPosted, opening, posting, title])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      header={
        <View className="flex-row items-center justify-between px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <XIcon color={colors.textPrimary} size={20} />
          </Pressable>
          <View className="flex-row items-center gap-2">
            <Sparkle color={colors.brandUi} size={16} weight="regular" />
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textSecondary }}
            >
              AI Discussion Starter
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      }
      footer={
        <View className="flex-row items-center justify-end">
          <Pressable
            onPress={post}
            disabled={!title.trim() || !opening.trim() || posting}
            className="px-5 py-2 rounded-full"
            style={{
              backgroundColor:
                title.trim() && opening.trim() ? colors.brandUi : colors.bgDisabled,
              opacity: posting ? 0.7 : 1,
            }}
          >
            {posting ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                Post thread
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textTertiary,
                marginBottom: 16,
              }}
            >
              {bookTitle
                ? `Drafted for ${bookTitle}${currentChapter ? ` · ${currentChapter}` : ''}.`
                : 'No current book set, generation will fail until the club picks one.'}
            </Text>

            {generating ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brandUi} />
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginTop: 8,
                  }}
                >
                  Drafting a starter…
                </Text>
              </View>
            ) : (
              <>
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Thread title"
                  placeholderTextColor={colors.textTertiary}
                  style={inputStyle(colors)}
                  maxLength={120}
                />

                <FieldLabel>Opening post</FieldLabel>
                <TextInput
                  value={opening}
                  onChangeText={setOpening}
                  placeholder="What do you want to discuss?"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  style={{ ...inputStyle(colors), height: 180, textAlignVertical: 'top' }}
                />

                <View
                  className="flex-row items-center justify-between mt-3 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                    Mark as containing spoilers
                  </Text>
                  <Switch
                    value={hasSpoilers}
                    onValueChange={setHasSpoilers}
                    trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
                  />
                </View>

                <Pressable
                  onPress={generate}
                  className="flex-row items-center justify-center gap-2 mt-4 py-2 rounded-full border"
                  style={{ borderColor: colors.borderInteractive }}
                >
                  <ArrowsClockwise color={colors.textPrimary} size={14} />
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
                    Re-generate
                  </Text>
                </Pressable>
              </>
            )}

            {error ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.errorBg,
                }}
              >
                <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error }}>
                  {error}
                </Text>
              </View>
            ) : null}
    </SheetScaffold>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 12,
        color: colors.textTertiary,
        marginTop: 12,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {children}
    </Text>
  )
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const
}
