import { useColors } from '@/constants/colors'
import { FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import type { ClubCard } from '@foxing/types'
import { BookOpen, CaretDown, CaretUp } from 'phosphor-react-native'
import { useState } from 'react'

/** What a cover tile needs; book cards and today's pick both have it. */
export interface MiniBook {
  slug: string
  title: string
  author: string
  coverUrl: string | null
}

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
  books: MiniBook[]
  onPressBook: (slug: string) => void
}) {
  return (
    <SectionWrap title={title}>
      <FlatList
        horizontal
        data={books}
        keyExtractor={(b) => b.slug}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <BookMini book={item} onPress={() => onPressBook(item.slug)} />}
      />
    </SectionWrap>
  )
}

function BookMini({ book, onPress }: { book: MiniBook; onPress: () => void }) {
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
        {book.coverUrl ? (
          <Image source={{ uri: book.coverUrl }} style={{ width: '100%', height: '100%' }} />
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

export function ClubMiniCard({ club, onPress }: { club: ClubCard; onPress: () => void }) {
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
      {club.currentBook ? (
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}
          numberOfLines={1}
        >
          Reading {club.currentBook.title}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between" style={{ marginTop: 8 }}>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary }}>
          {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
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

// Today's Pick hero: the Book of the Month, or the latest staff pick.
export function TodaysPickHero({ book, onOpen }: { book: MiniBook; onOpen: () => void }) {
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
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
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

// Browse-by collapsible: era and length chip rows behind one header, so the default
// discover view stays clean.
export function BrowseBy({
  eras,
  lengths,
  onPick,
}: {
  eras: ReadonlyArray<{ slug: string; label: string }>
  lengths: ReadonlyArray<{ slug: string; label: string }>
  onPick: (type: 'era' | 'length', slug: string, label: string) => void
}) {
  const colors = useColors()
  const [open, setOpen] = useState(false)
  const pick = (type: 'era' | 'length', list: ReadonlyArray<{ slug: string; label: string }>) => (label: string) => {
    const match = list.find((x) => x.label === label)
    if (match) onPick(type, match.slug, match.label)
  }
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
          <ChipRow title="Era" values={eras.map((e) => e.label)} onPress={pick('era', eras)} />
          <ChipRow title="Length" values={lengths.map((l) => l.label)} onPress={pick('length', lengths)} />
        </View>
      ) : null}
    </View>
  )
}
