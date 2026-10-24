import { useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  Share,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Screen } from '@/components/ui/screen'
import { useLocalSearchParams, useRouter } from 'expo-router'
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import {
  CaretLeft,
  Share as ShareIcon,
  DownloadSimple,
  Check,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { CardPreview } from '@/components/quote/card-preview'
import { TemplatePicker } from '@/components/quote/template-picker'
import { TEMPLATES, type CardType, type TemplateId } from '@/components/quote/types'

// Five card types now. The original "quote" type renders the editable
// passage with template picker; the new types are content-shaped one-shots
// pre-filled from caller route params.
//
// SQL SCHEMA (for the saved-card library, already shipped in Phase 8):
//   create table quote_cards (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid not null references profiles(id) on delete cascade,
//     book_id uuid references books(id),
//     passage_text text not null,
//     template text not null check (template in ('minimal','ornate','dark','sepia')),
//     created_at timestamptz not null default now()
//   );

export default function QuoteCardScreen() {
  const colors = useColors()
  const router = useRouter()
  const params = useLocalSearchParams<{
    type?: CardType
    passageText?: string
    bookTitle?: string
    author?: string
    bookId?: string
    coverUrl?: string
    rating?: string
    daysToRead?: string
    highlightCount?: string
    progress?: string
    clubId?: string
    clubName?: string
    memberCount?: string
  }>()

  const cardType: CardType = (params.type as CardType) ?? 'quote'
  // Each type picks a sensible default template, user can still flip on quote.
  const defaultTemplate: TemplateId =
    cardType === 'finished' ? 'ornate'
      : cardType === 'reading' ? 'dark'
      : cardType === 'club_invite' ? 'sepia'
      : 'minimal'

  const [template, setTemplate] = useState<TemplateId>(defaultTemplate)
  const [passage, setPassage] = useState<string>(params.passageText ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const viewShotRef = useRef<ViewShotRef | null>(null)

  // Snapshot the live preview to a PNG file. ViewShot returns a file://
  // URI we can hand to MediaLibrary / Share.
  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await captureRef(viewShotRef as unknown as React.RefObject<View>, {
        format: 'png',
        quality: 0.95,
      })
      return uri
    } catch (e) {
      console.warn('[quote-card] capture failed:', e instanceof Error ? e.message : e)
      return null
    }
  }, [])

  const def = TEMPLATES[template]
  const bookTitle = params.bookTitle ?? 'Unknown title'
  const author = params.author ?? ''
  const bookId = params.bookId ?? null
  const coverUrl = params.coverUrl ?? null
  const rating = params.rating ? parseInt(params.rating, 10) : 0
  const daysToRead = params.daysToRead ? parseInt(params.daysToRead, 10) : null
  const highlightCount = params.highlightCount ? parseInt(params.highlightCount, 10) : null
  const progress = params.progress ? parseFloat(params.progress) : null
  const clubName = params.clubName ?? null
  const clubId = params.clubId ?? null
  const memberCount = params.memberCount ? parseInt(params.memberCount, 10) : null

  const deepLink =
    cardType === 'club_invite' && clubId
      ? `foxing.app/clubs/${clubId}`
      : bookId
        ? `foxing.app/book/${bookId}`
        : 'foxing.app'

  const shareText = useMemo(() => {
    const meta = author ? `${bookTitle}, ${author}` : bookTitle
    if (cardType === 'finished') {
      return `I just finished "${bookTitle}" by ${author} on Foxing. ${deepLink}`
    }
    if (cardType === 'reading') {
      return `I'm reading "${bookTitle}" by ${author} on Foxing. Join me: ${deepLink}`
    }
    if (cardType === 'club_invite') {
      return `Join "${clubName ?? 'our book club'}" on Foxing, we're reading "${bookTitle}". ${deepLink}`
    }
    return `"${passage}"\n\n${meta}\n\nShared from Foxing`
  }, [author, bookTitle, cardType, clubName, deepLink, passage])

  const onShare = useCallback(async () => {
    if (cardType === 'quote' && !passage.trim()) {
      setToast('Add a passage first.')
      setTimeout(() => setToast(null), 1800)
      return
    }
    // Capture the live preview to a PNG and share both the image + caption.
    // Share.share's `url` field is iOS-only for files; on Android Share
    // accepts message-only, so we always pass the message too.
    const uri = await captureCard()
    try {
      if (uri) {
        await Share.share({ url: uri, message: shareText })
      } else {
        await Share.share({ message: shareText })
      }
    } catch (e) {
      console.warn('[quote-card] share failed:', e instanceof Error ? e.message : e)
    }
  }, [captureCard, cardType, passage, shareText])

  const onSave = useCallback(async () => {
    if (cardType === 'quote' && !passage.trim()) {
      setToast('Add a passage first.')
      setTimeout(() => setToast(null), 1800)
      return
    }
    setSaving(true)
    // Save the rendered card to Photos. Permission gate first; on iOS the prompt covers
    // Photos, on Android the Photos API.
    let toastMessage = 'Saved to Photos.'
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (perm.status !== 'granted') {
        toastMessage = 'Allow Photos access to save the card.'
      } else {
        const uri = await captureCard()
        if (uri) {
          await MediaLibrary.saveToLibraryAsync(uri)
          toastMessage = 'Saved to Photos.'
        }
      }
    } catch (e) {
      console.warn('[quote-card] image save failed:', e instanceof Error ? e.message : e)
      toastMessage = "Couldn't save the card to Photos."
    }
    setSaved(true)
    setSaving(false)
    setToast(toastMessage)
    setTimeout(() => {
      setToast(null)
      setSaved(false)
    }, 3000)
  }, [captureCard, cardType, passage])

  return (
    <Screen>
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          {cardType === 'finished'
            ? 'I finished'
            : cardType === 'reading'
              ? "I'm reading"
              : cardType === 'club_invite'
                ? 'Club invitation'
                : 'Quote card'}
        </Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
          {/* Wrapped in ViewShot so capture targets exactly the card rect
              (not the surrounding ScrollView padding). The inner View has
              collapsable={false} because Android RN may otherwise flatten
              it and the screenshot would miss it. */}
          <ViewShot
            ref={viewShotRef as unknown as React.RefObject<ViewShotRef>}
            options={{ format: 'png', quality: 0.95 }}
          >
          <View collapsable={false}>
            <CardPreview
              cardType={cardType}
              template={def}
              passage={passage}
              bookTitle={bookTitle}
              author={author}
              coverUrl={coverUrl}
              rating={rating}
              daysToRead={daysToRead}
              highlightCount={highlightCount}
              progress={progress}
              clubName={clubName}
              memberCount={memberCount}
              deepLink={deepLink}
            />
          </View>
          </ViewShot>

          {/* Template picker, quote type is fully editable; the content
              types ship with a sensible default but the picker stays
              available in case the user wants a different look. */}
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            Template
          </Text>
          <TemplatePicker template={template} setTemplate={setTemplate} colors={colors} />

          {cardType === 'quote' ? (
            <>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 11,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginTop: 18,
                  marginBottom: 8,
                }}
              >
                Passage
              </Text>
              <TextInput
                value={passage}
                onChangeText={setPassage}
                placeholder="Paste or type a passage…"
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={500}
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />
            </>
          ) : null}

          {toast ? (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                backgroundColor: colors.bgSelected,
              }}
            >
              <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textPrimary }}>
                {toast}
              </Text>
            </View>
          ) : null}
      </KeyboardAwareScrollView>

      <View
        className="flex-row items-center gap-2 px-4 py-3 border-t border-border-subtle-light dark:border-border-subtle-dark"
      >
          <Pressable
            onPress={onSave}
            disabled={saving}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-full border"
            style={{ borderColor: colors.borderInteractive, opacity: saving ? 0.7 : 1 }}
          >
            {saved ? (
              <Check color={colors.success} size={16} weight="bold" />
            ) : (
              <DownloadSimple color={colors.textPrimary} size={16} />
            )}
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary, fontSize: 13 }}>
              {saved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-full"
            style={{ backgroundColor: colors.brandUi }}
          >
            <ShareIcon color={colors.textOnBrand} size={16} weight="regular" />
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 13 }}>
              Share
            </Text>
          </Pressable>
      </View>
    </Screen>
  )
}
