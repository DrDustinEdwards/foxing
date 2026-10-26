import { useBookAnnotations, useBookPage, useMyBook, useSetBookStatus } from '@foxing/client'
import type * as W from '@foxing/types'
import { useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  Alert,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  CaretLeft,
  ShareNetwork,
  Star,
  BookOpen,
  ImageSquare,
  Link as LinkIcon,
  Megaphone,
  CaretRight,
  CaretDown,
  BookmarkSimple,
  CheckCircle,
  Lightbulb,
  Student,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authClient, queueWrite } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { FinishReviewSheet } from '@/components/book/finish-review-sheet'
import { PrimaryCta } from '@/components/book/primary-cta'
import { BottomSheetMenu } from '@/components/book/bottom-sheet-menu'
import { PauseNoteModal } from '@/components/book/pause-note-modal'
import { ExpandableText, SecondaryButton, SectionHeading } from '@/components/book/book-detail-parts'
import { CompanionSheet } from '@/components/reader/companion-sheet'

function pacingLabel(p: string | null | undefined): string {
  if (p === 'slow') return 'Slow-paced'
  if (p === 'fast') return 'Fast-paced'
  if (p === 'medium') return 'Medium-paced'
  return ''
}

// The book page: the shared GET /books/:idOrSlug view (the same object the web page
// renders) plus the reader's own shelf state. Status changes patch the cache, so the
// page never reloads.
export default function BookDetail() {
  const colors = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const session = authClient.useSession()
  const signedIn = !!session.data
  const pageQuery = useBookPage(id ?? '')
  const page = pageQuery.data
  const book = page?.book ?? null
  const myBook = useMyBook(book?.id ?? '', undefined, signedIn && !!book)
  const userBook = myBook.data ?? null
  const annotations = useBookAnnotations(book?.id ?? '')
  const setBookStatus = useSetBookStatus()

  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  // Pause-note modal, captures the optional "why are you pausing?" note
  // when the user picks Pause from the status menu.
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const [pauseNote, setPauseNote] = useState('')
  // Finish review sheet, opens immediately after a fresh transition to
  // 'finished'. The celebration flow (quote card + series prompt) runs after
  // the sheet closes so we don't stack two routes on top of each other.
  const [finishReviewOpen, setFinishReviewOpen] = useState(false)
  const finishCelebrationRef = useRef<(() => void) | null>(null)
  // A Plus companion answer about the whole book.
  const [companion, setCompanion] = useState<'book_insight' | 'deep_dive' | null>(null)

  // Collapsibles, About/Deep Dive default closed.
  // Content warnings also default closed so they don't dominate the page.
  const [showDescription, setShowDescription] = useState(false)
  const [showContentWarnings, setShowContentWarnings] = useState(false)

  function setStatus(status: W.ShelfStatus) {
    setStatusMenuOpen(false)
    if (!book) return
    if (!signedIn) {
      router.push('/(auth)/login' as never)
      return
    }
    const wasFinished = userBook?.status === 'finished'
    setBookStatus.fire({ bookId: book.id, status, book })
    if (status !== 'finished' || wasFinished) return
    // Fresh transition to finished: the review sheet first, then the celebration
    // (quote card, and the next book in the series) once it closes.
    haptic.success()
    const daysToRead = userBook?.startedAt ? Math.max(1, Math.round((Date.now() - userBook.startedAt) / 86_400_000)) : null
    const highlightCount = (annotations.data?.mine ?? []).filter((m) => m.type === 'highlight').length
    const next = page?.nextInSeries ?? null
    finishCelebrationRef.current = () => {
      router.push({
        pathname: '/quote-card',
        params: {
          type: 'finished',
          bookId: book.id,
          bookTitle: book.title,
          author: book.author,
          coverUrl: book.coverUrl ?? '',
          daysToRead: daysToRead != null ? String(daysToRead) : '',
          highlightCount: String(highlightCount),
        },
      } as never)
      if (!next) return
      setTimeout(() => {
        Alert.alert(
          `Next in ${book.seriesName ?? 'the series'}`,
          `${next.title} is up next. Add it to your library?`,
          [
            { text: 'Maybe later', style: 'cancel' },
            {
              text: 'Add to Want to Read',
              onPress: () => setBookStatus.fire({ bookId: next.id, status: 'want', book: next }),
            },
            { text: 'Open', onPress: () => router.push(`/book/${next.slug}` as never) },
          ],
        )
      }, 600)
    }
    setFinishReviewOpen(true)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (pageQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }
  if (!book || !page) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
        >
          {pageQuery.isError && (pageQuery.error as { status?: number }).status !== 404
            ? "We couldn't load that book. Check your connection and try again."
            : "We couldn't find that book."}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3">
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const description = page.ai.description ?? book.description
  const readMinutes = book.wordCount ? Math.round(book.wordCount / 250) : null
  const readingTimeLabel = readMinutes
    ? readMinutes >= 60
      ? `~${Math.round(readMinutes / 60)} hr read`
      : `~${readMinutes} min read`
    : null

  const subjects = (book.subjects ?? []).slice(0, 8)

  return (
    <View className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Header with cover hero + gradient */}
        <View style={{ height: 320, backgroundColor: colors.bgSunken }}>
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              blurRadius={4}
            />
          ) : null}
          {/* Faux-gradient: solid translucent stripes at the bottom faking a fade.
              Avoids adding expo-linear-gradient as a native dep just for this. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
              backgroundColor: colors.bgBase,
              opacity: 0.55,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              backgroundColor: colors.bgBase,
              opacity: 0.85,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingTop: 48,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.scrimLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CaretLeft color={colors.textOnDark} size={18} />
            </Pressable>
            <Pressable
              onPress={() => setShareMenuOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share book"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.scrimLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShareNetwork color={colors.textOnDark} size={18} />
            </Pressable>
          </View>
          {/* Cover thumbnail centered over the bottom of the hero */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -30,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 120,
                height: 180,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              {book.coverUrl ? (
                <Image
                  source={{ uri: book.coverUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityRole="image"
                  accessibilityLabel={`${book.title} book cover`}
                />
              ) : (
                <View
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}
                >
                  <Text
                    style={{ fontFamily: Fonts.display, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
                    numberOfLines={4}
                  >
                    {book.title}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 48, paddingHorizontal: 20 }}>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 22,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {book.title}
          </Text>
          <Pressable
            onPress={() =>
              book.authorSlug && router.push(`/author/${book.authorSlug}` as never)
            }
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 14,
                color: colors.brandText,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {book.author}
            </Text>
          </Pressable>
          {book.seriesName ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: 2,
              }}
            >
              {book.seriesName}{book.seriesOrder ? `, book ${book.seriesOrder}` : ''}
            </Text>
          ) : null}
          {readingTimeLabel ? (
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {readingTimeLabel}
            </Text>
          ) : null}

          {subjects.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 12, gap: 6 }}
            >
              {subjects.map((s) => (
                <View
                  key={s}
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.brandSubtle }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.brandSubtleText,
                    }}
                    numberOfLines={1}
                  >
                    {s.split(/[\u2014\u2013\-:]/)[0].trim().slice(0, 40)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {/* Primary CTA */}
          <PrimaryCta
            userBook={userBook}
            onAddPress={() => setStatusMenuOpen(true)}
            onContinue={() => {
              if (!book.readable) return
              if (userBook?.status !== 'reading') setStatus('reading')
              router.push(`/reader/${book.id}` as never)
            }}
            onReread={() => {
              setStatus('reading')
              router.push(`/reader/${book.id}` as never)
            }}
          />

          {/* Secondary row */}
          <View className="flex-row items-center justify-around mt-3 mb-2">
            <SecondaryButton
              Icon={BookmarkSimple}
              label="Want"
              onPress={() => setStatus('want')}
              active={userBook?.status === 'want'}
            />
            <SecondaryButton
              Icon={CheckCircle}
              label="Finished"
              onPress={() => setStatus('finished')}
              active={userBook?.status === 'finished'}
            />
            <SecondaryButton
              Icon={ShareNetwork}
              label="Share"
              onPress={() => setShareMenuOpen(true)}
            />
          </View>
        </View>

        {/* Community, rating + mood + pacing. Surfaced ABOVE Where to Read
            and the AI sections per task.md Section 1 so the social signal
            leads. */}
        <SectionHeading>Community</SectionHeading>
        <View style={{ paddingHorizontal: 20 }}>
          <View className="flex-row items-center" style={{ marginBottom: 12 }}>
            <Star color={colors.brandSecondary} size={18} weight="fill" />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 15,
                color: colors.textPrimary,
                marginLeft: 6,
              }}
            >
              {book.rating ? book.rating.toFixed(1) : ''}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginLeft: 10,
              }}
            >
              {book.ratingCount > 0 ? `${book.ratingCount} rating${book.ratingCount === 1 ? '' : 's'}, ` : ''}
              {page.readerCount} reader{page.readerCount === 1 ? '' : 's'}
            </Text>
          </View>
          {book.moodTags && book.moodTags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
              style={{ marginBottom: 8 }}
            >
              {book.moodTags.map((m) => (
                <View
                  key={m}
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.brandSubtle }}
                >
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandSubtleText }}
                    numberOfLines={1}
                  >
                    {m}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {book.pacing ? (
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary }}
            >
              Most readers say:{' '}
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
                {pacingLabel(book.pacing)}
              </Text>
            </Text>
          ) : null}
        </View>

        {/* Content warnings, collapsed by default so they don't dominate. */}
        {book.contentWarnings && book.contentWarnings.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Pressable
              onPress={() => setShowContentWarnings((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                showContentWarnings ? 'Hide content warnings' : 'Show content warnings'
              }
              accessibilityState={{ expanded: showContentWarnings }}
              className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
              >
                Content warnings
              </Text>
              {showContentWarnings ? (
                <CaretDown color={colors.textTertiary} size={14} />
              ) : (
                <CaretRight color={colors.textTertiary} size={14} />
              )}
            </Pressable>
            {showContentWarnings ? (
              <View
                className="mt-2 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                {book.contentWarnings.map((w) => (
                  <Text
                    key={w}
                    style={{
                      fontFamily: Fonts.body,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    • {w}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Where to Read, surfaced high up per task.md Section D so users
            see read/library/buy options before the AI cards. */}
        <SectionHeading>Where to read</SectionHeading>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {book.readable ? (
            <Pressable
              onPress={() => router.push(`/reader/${book.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel="Read this book in Foxing"
              className="px-4 py-3 rounded-xl items-center"
              style={{ backgroundColor: colors.brandUi }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 14 }}>
                Read free in Foxing
              </Text>
            </Pressable>
          ) : null}
          {page.buys.map((b) => (
            <Pressable
              key={b.retailer}
              onPress={() => Linking.openURL(b.url)}
              accessibilityRole="link"
              accessibilityLabel={b.sponsored ? `${b.label} (affiliate link)` : b.label}
              className="px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark items-center"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary, fontSize: 14 }}>
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* About this book, collapsed by default per task.md Section 1.
            Lazy-loads the AI description on first expand. */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <Pressable
            onPress={() => setShowDescription((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              showDescription ? 'Hide about this book' : 'Show about this book'
            }
            accessibilityState={{ expanded: showDescription }}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
              About this book
            </Text>
            {showDescription ? (
              <CaretDown color={colors.textTertiary} size={14} />
            ) : (
              <CaretRight color={colors.textTertiary} size={14} />
            )}
          </Pressable>
          {showDescription ? (
            <View style={{ marginTop: 8 }}>
              {description ? (
                <ExpandableText text={description} />
              ) : (
                <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
                  No description yet.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {page.ai.authorBio ? (
          <>
            <SectionHeading>About {book.author}</SectionHeading>
            <View style={{ paddingHorizontal: 20 }}>
              <ExpandableText text={page.ai.authorBio} />
            </View>
          </>
        ) : null}

        {page.ai.readingOrder ? (
          <>
            <SectionHeading>Reading order</SectionHeading>
            <View style={{ paddingHorizontal: 20 }}>
              <ExpandableText text={page.ai.readingOrder} />
            </View>
          </>
        ) : null}

        {/* Plus companion answers about the whole book. */}
        <SectionHeading>Ask the companion</SectionHeading>
        <View className="flex-row" style={{ paddingHorizontal: 20, gap: 8 }}>
          {([
            { action: 'book_insight', label: 'An insight', Icon: Lightbulb },
            { action: 'deep_dive', label: 'Go deeper', Icon: Student },
          ] as const).map((t) => (
            <Pressable
              key={t.action}
              onPress={() => (signedIn ? setCompanion(t.action) : router.push('/(auth)/login' as never))}
              accessibilityRole="button"
              className="flex-1 flex-row items-center justify-center px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ gap: 8 }}
            >
              <t.Icon color={colors.brandUi} size={18} />
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {page.awards.length > 0 ? (
          <>
            <SectionHeading>Awards</SectionHeading>
            <View style={{ paddingHorizontal: 20, gap: 4 }}>
              {page.awards.map((a) => (
                <Text
                  key={`${a.awardSlug}:${a.year}:${a.distinction}`}
                  style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textSecondary }}
                >
                  {a.awardName}
                  {a.year ? ` ${a.year}` : ''}
                  {a.distinction && a.distinction !== 'winner' ? `, ${a.distinction}` : ''}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {/* Reviews + Similar were previously bundled under Community. Per
            task.md Section 1 they're now distinct sections, reviews sits
            with the social signal, similar books lives further down. */}
        <SectionHeading>Recent reviews</SectionHeading>
        <View style={{ paddingHorizontal: 20 }}>
          {page.reviews.length === 0 ? (
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginBottom: 12,
              }}
            >
              No public reviews yet.
            </Text>
          ) : (
            page.reviews.map((r) => (
              <View
                key={r.id}
                className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <View className="flex-row items-center" style={{ marginBottom: 4 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                  >
                    {r.author?.displayName ?? r.author?.username ?? 'Reader'}
                  </Text>
                  {r.ratingHalf ? (
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 11,
                        color: colors.brandSecondary,
                        marginLeft: 8,
                      }}
                    >
                      {'★'.repeat(Math.floor(r.ratingHalf / 2))}
                      {r.ratingHalf % 2 ? '½' : ''}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 18,
                  }}
                  numberOfLines={4}
                >
                  {r.containsSpoilers ? 'Contains spoilers.' : r.review}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Popular highlights, public passages from other readers. */}
        {page.popular.length > 0 ? (
          <>
            <SectionHeading>Popular highlights</SectionHeading>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {page.popular.map((h) => {
                return (
                  <View
                    key={h.normalizedText}
                    className="p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.bodyItalic,
                        fontSize: 14,
                        color: colors.textPrimary,
                        lineHeight: 21,
                      }}
                      numberOfLines={4}
                    >
                      "{h.normalizedText}"
                    </Text>
                    <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>
                      Highlighted by {h.count} readers
                    </Text>
                  </View>
                )
              })}
            </View>
          </>
        ) : null}

        {/* Similar books, extracted from the old Community block per
            task.md Section 1. */}
        {page.ai.similarBooks ? (
          <>
            <SectionHeading>If you like this</SectionHeading>
            <View style={{ paddingHorizontal: 20 }}>
              <ExpandableText text={page.ai.similarBooks} />
            </View>
          </>
        ) : null}

        <BookRow title="Readers also liked" books={page.related} onOpen={(slug) => router.push(`/book/${slug}` as never)} />
        {page.nextInSeries ? (
          <BookRow
            title={`Next in ${book.seriesName ?? 'the series'}`}
            books={[page.nextInSeries]}
            onOpen={(slug) => router.push(`/book/${slug}` as never)}
          />
        ) : null}

        {/* Author section */}
        {page.moreByAuthor.length > 0 ? (
          <>
            <BookRow
              title={`More by ${book.author}`}
              books={page.moreByAuthor}
              onOpen={(slug) => router.push(`/book/${slug}` as never)}
            />
            <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
              <Pressable
                onPress={() => book.authorSlug && router.push(`/author/${book.authorSlug}` as never)}
                className="flex-row items-center"
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 13 }}>
                  View author page
                </Text>
                <CaretRight color={colors.brandText} size={14} />
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Clubs reading this */}
        {page.clubs.length > 0 ? (
          <>
            <SectionHeading>Clubs reading this</SectionHeading>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {page.clubs.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/clubs/${c.id}` as never)}
                  className="flex-row items-center p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {c.memberCount} members
                    </Text>
                  </View>
                  <Text
                    style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}
                  >
                    Open
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

      </ScrollView>

      {/* Add to Library status menu */}
      <BottomSheetMenu
        visible={statusMenuOpen}
        title="Add to library"
        onClose={() => setStatusMenuOpen(false)}
        items={[
          { id: 'want', label: 'Want to Read', onPress: () => setStatus('want') },
          { id: 'reading', label: 'Currently Reading', onPress: () => setStatus('reading') },
          ...(book.readable
            ? [
                {
                  id: 'now',
                  label: 'Start Reading Now',
                  onPress: () => {
                    setStatus('reading')
                    router.push(`/reader/${book.id}` as never)
                  },
                },
              ]
            : []),
          { id: 'finished', label: 'Finished', onPress: () => setStatus('finished') },
          {
            id: 'pause',
            label: 'Pause Reading',
            onPress: () => {
              setPauseNote('')
              setPauseModalOpen(true)
            },
          },
        ]}
      />

      <FinishReviewSheet
        visible={finishReviewOpen}
        bookId={book.id}
        bookTitle={book.title}
        onClose={() => {
          setFinishReviewOpen(false)
          const run = finishCelebrationRef.current
          finishCelebrationRef.current = null
          if (run) run()
        }}
      />

      <PauseNoteModal
        visible={pauseModalOpen}
        note={pauseNote}
        onChangeNote={setPauseNote}
        onCancel={() => setPauseModalOpen(false)}
        onConfirm={() => {
          setPauseModalOpen(false)
          setStatus('paused')
          const note = pauseNote.trim()
          if (note) void queueWrite({ resource: 'user_book', verb: 'update', payload: { bookId: book.id, pausedNote: note } })
        }}
      />

      {/* Share menu */}
      <BottomSheetMenu
        visible={shareMenuOpen}
        title="Share"
        onClose={() => setShareMenuOpen(false)}
        items={[
          {
            id: 'quote',
            label: 'Create Quote Card',
            Icon: ImageSquare,
            onPress: () => {
              router.push(
                `/quote-card?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}` as never,
              )
            },
          },
          {
            id: 'reading',
            label: "I'm Reading This",
            Icon: Megaphone,
            onPress: async () => {
              try {
                await Share.share({
                  message: `I'm reading "${book.title}" by ${book.author} on Foxing. https://foxing.app/books/${book.slug}`,
                })
              } catch {
                /* user canceled */
              }
            },
          },
          {
            id: 'link',
            label: 'Copy link',
            Icon: LinkIcon,
            onPress: async () => {
              try {
                await Share.share({ message: `https://foxing.app/books/${book.slug}` })
              } catch {
                /* user canceled */
              }
            },
          },
        ]}
      />

      <CompanionSheet
        visible={companion !== null}
        title={companion === 'deep_dive' ? 'Go deeper' : 'An insight'}
        eyebrow={book.title}
        request={companion ? { action: companion, bookId: book.id } : null}
        onClose={() => setCompanion(null)}
      />
    </View>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function BookRow({
  title,
  books,
  onOpen,
}: {
  title: string
  books: W.BookCard[]
  onOpen: (slug: string) => void
}) {
  const colors = useColors()
  if (books.length === 0) return null
  return (
    <>
      <SectionHeading>{title}</SectionHeading>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {books.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onOpen(b.slug)}
            accessibilityRole="link"
            accessibilityLabel={`${b.title} by ${b.author}`}
            style={{ width: 100 }}
          >
            <View
              style={{
                width: 100,
                height: 150,
                borderRadius: 6,
                overflow: 'hidden',
                backgroundColor: colors.bgSunken,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              {b.coverUrl ? (
                <Image source={{ uri: b.coverUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <BookOpen color={colors.textTertiary} size={20} />
              )}
            </View>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textPrimary }} numberOfLines={2}>
              {b.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  )
}
