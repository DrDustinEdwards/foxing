import { useColors } from '@/constants/colors'
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type { ClubLite, SupaBook } from './discover-types'
import { ArrowsClockwise, BookOpen, CaretDown, CaretUp, Sparkle } from 'phosphor-react-native'
import type { RecommendedBook } from '@/lib/recommendations'
import { useState } from 'react'

export function SectionWrap({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

export function SectionRow({
  title,
  books,
  onPressBook,
}: {
  title: string
  books: SupaBook[]
  onPressBook: (id: string) => void
}) {
  return (
    <SectionWrap title={title}>
      <FlatList
        horizontal
        data={books}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <SupaBookMini book={item} onPress={() => onPressBook(item.id)} />}
      />
    </SectionWrap>
  )
}

function SupaBookMini({ book, onPress }: { book: SupaBook; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} style={{ width: 110 }}>
      <View
        style={{
          width: 110,
          height: 160,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: colors.bgSunken,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <BookOpen color={colors.textTertiary} size={20} />
        )}
      </View>
      <Text
        style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}
        numberOfLines={2}
      >
        {book.title}
      </Text>
      <Text
        style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
        numberOfLines={1}
      >
        {book.author}
      </Text>
    </Pressable>
  )
}

export function ChipRow({
  title,
  values,
  onPress,
}: {
  title: string
  values: string[]
  onPress: (v: string) => void
}) {
  const colors = useColors()
  return (
    <SectionWrap title={title}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
      >
        {values.map((v) => (
          <Pressable
            key={v}
            onPress={() => onPress(v)}
            className="px-3 py-2 rounded-full border"
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
            }}
          >
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}
            >
              {v}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SectionWrap>
  )
}

export function ClubMiniCard({ club, onPress }: { club: ClubLite; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ width: 200 }}
    >
      <Text
        style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
        numberOfLines={2}
      >
        {club.name}
      </Text>
      {club.current_book ? (
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}
          numberOfLines={1}
        >
          Reading {club.current_book.title}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between" style={{ marginTop: 8 }}>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}>
          {club.member_count} member{club.member_count === 1 ? '' : 's'}
        </Text>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.brandText }}
        >
          Open →
        </Text>
      </View>
    </Pressable>
  )
}

function RecommendedSection({
  recs,
  busy,
  onRefresh,
  onTap,
}: {
  recs: RecommendedBook[] | null
  busy: boolean
  onRefresh: () => void
  onTap: (r: RecommendedBook) => void
}) {
  const colors = useColors()
  if (!recs && !busy) return null
  return (
    <View style={{ marginTop: 18 }}>
      <View className="flex-row items-center justify-between px-4" style={{ marginBottom: 10 }}>
        <View className="flex-row items-center gap-2">
          <Sparkle color={colors.brandUi} size={14} weight="regular" />
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Recommended for you
          </Text>
        </View>
        <Pressable onPress={onRefresh} disabled={busy} hitSlop={8}>
          {busy ? (
            <ActivityIndicator color={colors.brandUi} size="small" />
          ) : (
            <ArrowsClockwise color={colors.textTertiary} size={14} />
          )}
        </Pressable>
      </View>
      {busy && !recs ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : recs && recs.length === 0 ? (
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 12,
            color: colors.textTertiary,
            paddingHorizontal: 16,
          }}
        >
          We need a little more reading history to suggest something.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        >
          {(recs ?? []).map((r) => (
            <Pressable
              key={`${r.title}:${r.author}`}
              onPress={() => onTap(r)}
              className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ width: 240 }}
            >
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}
                numberOfLines={2}
              >
                {r.title}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {r.author}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.bodyItalic,
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 8,
                  lineHeight: 17,
                }}
                numberOfLines={3}
              >
                {r.reason}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// Today's Pick hero, a large card with the rotating daily book.
export function TodaysPickHero({ book, onOpen }: { book: SupaBook; onOpen: () => void }) {
  const colors = useColors()
  return (
    <View style={{ marginTop: 18, marginBottom: 4 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        Today's pick
      </Text>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Today's pick: ${book.title} by ${book.author}`}
        className="mx-4 flex-row rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        style={{ padding: 14, gap: 14 }}
      >
        <View
          style={{
            width: 90,
            height: 130,
            borderRadius: 6,
            overflow: 'hidden',
            backgroundColor: colors.bgSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {book.cover_url ? (
            <Image
              source={{ uri: book.cover_url }}
              style={{ width: '100%', height: '100%' }}
              accessibilityRole="image"
              accessibilityLabel={`${book.title} cover`}
            />
          ) : (
            <BookOpen color={colors.textTertiary} size={22} />
          )}
        </View>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View>
            <Text
              style={{ fontFamily: Fonts.displayBold, fontSize: 17, color: colors.textPrimary }}
              numberOfLines={2}
            >
              {book.title}
            </Text>
            <Text
              style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
              numberOfLines={1}
            >
              {book.author}
            </Text>
          </View>
          <View
            className="self-start px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.brandUi, marginTop: 12 }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textOnBrand }}>
              Start reading
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

// Browse-by collapsible, wraps Era / Length / Theme / Country chip rows
// behind a single tappable header so the default discover view stays clean.
export function BrowseBy({
  eras,
  lengths,
  themes,
  countries,
  onPick,
}: {
  eras: readonly string[]
  lengths: ReadonlyArray<{ label: string; value: string }>
  themes: readonly string[]
  countries: readonly string[]
  onPick: (type: string, value: string) => void
}) {
  const colors = useColors()
  const [open, setOpen] = useState(false)
  return (
    <View style={{ marginTop: 18 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide browse-by categories' : 'Show browse-by categories'}
        accessibilityState={{ expanded: open }}
        className="flex-row items-center mx-4 px-4 py-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: colors.textPrimary,
            flex: 1,
          }}
        >
          Browse by
        </Text>
        {open ? (
          <CaretUp color={colors.textTertiary} size={14} />
        ) : (
          <CaretDown color={colors.textTertiary} size={14} />
        )}
      </Pressable>
      {open ? (
        <View style={{ marginTop: 8 }}>
          <ChipRow title="Era" values={[...eras]} onPress={(v) => onPick('era', v)} />
          <ChipRow
            title="Length"
            values={lengths.map((l) => l.label)}
            onPress={(label) => {
              const match = lengths.find((l) => l.label === label)
              if (match) onPick('length', match.value)
            }}
          />
          <ChipRow title="Theme" values={[...themes]} onPress={(v) => onPick('theme', v)} />
          <ChipRow title="Country" values={[...countries]} onPress={(v) => onPick('country', v)} />
        </View>
      ) : null}
    </View>
  )
}
