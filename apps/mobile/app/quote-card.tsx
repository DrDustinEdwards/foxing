import { useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  Share,
  Image,
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
  Star,
  Highlighter,
  BookOpen,
  UsersThree,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

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

type CardType = 'quote' | 'finished' | 'reading' | 'club_invite'
type TemplateId = 'minimal' | 'ornate' | 'dark' | 'sepia'

interface TemplateDef {
  id: TemplateId
  label: string
  background: string
  bodyColor: string
  metaColor: string
  wordmarkColor: string
  borderColor?: string
}

// Sanctioned hardcoded palette: share-card templates are fixed artwork that
// must render identically in both color schemes. Do not tokenize.
const TEMPLATES: Record<TemplateId, TemplateDef> = {
  minimal: { id: 'minimal', label: 'Minimal', background: '#FAF6EE', bodyColor: '#16100B', metaColor: '#815E41', wordmarkColor: '#B04A1C' },
  ornate: { id: 'ornate', label: 'Ornate', background: '#B04A1C', bodyColor: '#FFFFFF', metaColor: '#FAE0D6', wordmarkColor: '#FAE0D6', borderColor: '#FAE0D6' },
  dark: { id: 'dark', label: 'Dark', background: '#16100B', bodyColor: '#F5EDDE', metaColor: '#C4AE96', wordmarkColor: '#E07840' },
  sepia: { id: 'sepia', label: 'Sepia', background: '#F5EDDA', bodyColor: '#2A1E12', metaColor: '#815E41', wordmarkColor: '#8A3610' },
}
const TEMPLATE_ORDER: TemplateId[] = ['minimal', 'ornate', 'dark', 'sepia']

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
    // 1) Always persist the card row so it shows up in the user's card
    //    library, regardless of whether the image save succeeds.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const text =
        cardType === 'quote'
          ? passage.trim()
          : cardType === 'finished'
            ? `I just finished ${bookTitle}`
            : cardType === 'reading'
              ? `Currently reading ${bookTitle}`
              : `Invited to ${clubName ?? bookTitle}`
      const { error } = await supabase.from('quote_cards').insert({
        user_id: user.id,
        book_id: bookId,
        passage_text: text.slice(0, 1200),
        template,
      })
      if (error) console.warn('[quote-card] save row failed:', error.message)
    }
    // 2) Capture the preview and save to camera roll via MediaLibrary.
    //    Permission gate first; on iOS the prompt covers Photos, on
    //    Android it's the WRITE_EXTERNAL_STORAGE / Photos API.
    let toastMessage = 'Saved to your card library.'
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (perm.status !== 'granted') {
        toastMessage = 'Saved to your card library. (Allow Photos access to save the image.)'
      } else {
        const uri = await captureCard()
        if (uri) {
          await MediaLibrary.saveToLibraryAsync(uri)
          toastMessage = 'Saved to your card library and Photos.'
        }
      }
    } catch (e) {
      console.warn('[quote-card] image save failed:', e instanceof Error ? e.message : e)
      toastMessage = "Saved to your card library. Couldn't write the image to Photos."
    }
    setSaved(true)
    setSaving(false)
    setToast(toastMessage)
    setTimeout(() => {
      setToast(null)
      setSaved(false)
    }, 3000)
  }, [bookId, bookTitle, captureCard, cardType, clubName, passage, template])

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
          <View className="flex-row gap-2">
            {TEMPLATE_ORDER.map((id) => {
              const t = TEMPLATES[id]
              const active = id === template
              return (
                <Pressable
                  key={id}
                  onPress={() => setTemplate(id)}
                  style={{
                    flex: 1,
                    aspectRatio: 4 / 5,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.brandUi : colors.borderSubtle,
                    backgroundColor: t.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 10,
                      color: t.bodyColor,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

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

// ── Card preview, dispatches on type ────────────────────────────────────

interface CardPreviewProps {
  cardType: CardType
  template: TemplateDef
  passage: string
  bookTitle: string
  author: string
  coverUrl: string | null
  rating: number
  daysToRead: number | null
  highlightCount: number | null
  progress: number | null
  clubName: string | null
  memberCount: number | null
  deepLink: string
}

function CardPreview(props: CardPreviewProps) {
  const { cardType, template, bookTitle, author, deepLink } = props
  const baseStyle = {
    aspectRatio: 4 / 5,
    borderRadius: 14,
    overflow: 'hidden' as const,
    backgroundColor: template.background,
    padding: 24,
    borderWidth: template.borderColor ? 1 : 0,
    borderColor: template.borderColor ?? 'transparent',
  }

  if (cardType === 'finished') return <FinishedCard {...props} baseStyle={baseStyle} />
  if (cardType === 'reading') return <ReadingCard {...props} baseStyle={baseStyle} />
  if (cardType === 'club_invite') return <ClubInviteCard {...props} baseStyle={baseStyle} />

  // Default "quote" card
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 18,
            lineHeight: 26,
            color: template.bodyColor,
          }}
          numberOfLines={10}
        >
          {props.passage ? `“${props.passage}”` : 'Your passage will appear here.'}
        </Text>
      </View>
      <CardFooter template={template} bookTitle={bookTitle} author={author} deepLink={deepLink} />
    </View>
  )
}

function FinishedCard({
  template,
  bookTitle,
  author,
  coverUrl,
  rating,
  daysToRead,
  highlightCount,
  deepLink,
  baseStyle,
}: CardPreviewProps & { baseStyle: object }) {
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 16,
            color: template.metaColor,
            marginBottom: 18,
          }}
        >
          I just finished
        </Text>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 140, height: 210, borderRadius: 6, marginBottom: 16 }}
          />
        ) : (
          <View
            style={{
              width: 140,
              height: 210,
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <BookOpen color={template.bodyColor} size={28} />
          </View>
        )}
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: template.bodyColor,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {bookTitle}
        </Text>
        {author ? (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 13, color: template.metaColor, marginTop: 4 }}
          >
            {author}
          </Text>
        ) : null}
        {rating > 0 ? (
          <View className="flex-row" style={{ marginTop: 10, gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                color={template.bodyColor}
                size={14}
                weight={n <= rating ? 'fill' : 'regular'}
              />
            ))}
          </View>
        ) : null}
        {daysToRead != null || highlightCount != null ? (
          <View className="flex-row items-center" style={{ marginTop: 10, gap: 12 }}>
            {daysToRead != null ? (
              <Text
                style={{ fontFamily: Fonts.mono, fontSize: 11, color: template.metaColor }}
              >
                {daysToRead} day{daysToRead === 1 ? '' : 's'}
              </Text>
            ) : null}
            {highlightCount != null ? (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Highlighter color={template.metaColor} size={11} />
                <Text
                  style={{ fontFamily: Fonts.mono, fontSize: 11, color: template.metaColor }}
                >
                  {highlightCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <CardFooter template={template} bookTitle="" author="" deepLink={deepLink} />
    </View>
  )
}

function ReadingCard({
  template,
  bookTitle,
  author,
  coverUrl,
  progress,
  deepLink,
  baseStyle,
}: CardPreviewProps & { baseStyle: object }) {
  const pct = typeof progress === 'number' ? Math.round(progress * 100) : null
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 16,
            color: template.metaColor,
            marginBottom: 16,
          }}
        >
          I'm reading
        </Text>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 130, height: 195, borderRadius: 6, marginBottom: 16 }}
          />
        ) : (
          <View
            style={{
              width: 130,
              height: 195,
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <BookOpen color={template.bodyColor} size={28} />
          </View>
        )}
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: template.bodyColor,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {bookTitle}
        </Text>
        {author ? (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 13, color: template.metaColor, marginTop: 4 }}
          >
            {author}
          </Text>
        ) : null}
        {pct !== null ? (
          <View style={{ marginTop: 18, width: '70%' }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.18)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: 4,
                  backgroundColor: template.wordmarkColor,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: template.metaColor,
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              {pct}% complete
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: template.metaColor,
            marginTop: 16,
          }}
        >
          Join me on Foxing
        </Text>
      </View>
      <CardFooter template={template} bookTitle="" author="" deepLink={deepLink} />
    </View>
  )
}

function ClubInviteCard({
  template,
  bookTitle,
  coverUrl,
  clubName,
  memberCount,
  deepLink,
  baseStyle,
}: CardPreviewProps & { baseStyle: object }) {
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 14,
            color: template.metaColor,
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          You're invited to read with us
        </Text>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 22,
            color: template.bodyColor,
            marginBottom: 18,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {clubName ?? 'A Foxing Club'}
        </Text>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 110, height: 165, borderRadius: 6, marginBottom: 14 }}
          />
        ) : (
          <View
            style={{
              width: 110,
              height: 165,
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <UsersThree color={template.bodyColor} size={26} />
          </View>
        )}
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: template.bodyColor,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          Reading {bookTitle}
        </Text>
        {memberCount != null ? (
          <Text
            style={{ fontFamily: Fonts.mono, fontSize: 11, color: template.metaColor, marginTop: 4 }}
          >
            {memberCount} member{memberCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
      <CardFooter template={template} bookTitle="" author="" deepLink={deepLink} />
    </View>
  )
}

function CardFooter({
  template,
  bookTitle,
  author,
  deepLink,
}: {
  template: TemplateDef
  bookTitle: string
  author: string
  deepLink: string
}) {
  return (
    <View>
      {bookTitle ? (
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: template.metaColor }}
          numberOfLines={1}
        >
          {bookTitle}
        </Text>
      ) : null}
      {author ? (
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: template.metaColor, marginTop: 2 }}
          numberOfLines={1}
        >
          {author}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 10,
          color: template.metaColor,
          marginTop: 6,
        }}
        numberOfLines={1}
      >
        {deepLink}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 11,
          color: template.wordmarkColor,
          position: 'absolute',
          right: 0,
          bottom: 0,
        }}
      >
        Foxing
      </Text>
    </View>
  )
}
