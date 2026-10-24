import { useAuthor, useLibrary } from '@foxing/client'
import type * as W from '@foxing/types'
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, BookOpen, CheckCircle, Bookmark, Clock } from 'phosphor-react-native'
import { authClient } from '@/lib/api'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// An author's page: the shared GET /authors/:slug view, with a badge on the books
// already on the reader's shelf.
export default function AuthorScreen() {
  const colors = useColors()
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const author = useAuthor(slug ?? '')
  const session = authClient.useSession()
  const library = useLibrary()
  const statuses = new Map(session.data ? (library.data ?? []).map((e) => [e.bookId, e.status]) : [])
  const page = author.data

  if (author.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }
  if (!page) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}
        >
          We couldn't find that author.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3">
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 28,
            color: colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {page.name}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 12,
            color: colors.textTertiary,
            marginBottom: 16,
          }}
        >
          {page.bookCount} {page.bookCount === 1 ? 'work' : 'works'} in Foxing
          {page.yearRange ? `, ${page.yearRange.first} to ${page.yearRange.last}` : ''}
        </Text>

        {page.bio ? (
          <>
            <SectionHeading>About</SectionHeading>
            <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: colors.textPrimary, lineHeight: 23 }}>
              {page.bio}
            </Text>
          </>
        ) : null}

        {/* Works grid */}
        <SectionHeading>Works in Foxing</SectionHeading>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {page.books.map((b) => {
            const status = statuses.get(b.id)
            return (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/book/${b.slug}` as never)}
                style={{ width: '47%' }}
              >
                <View
                  style={{
                    aspectRatio: 2 / 3,
                    borderRadius: 6,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                  }}
                >
                  {b.coverUrl ? (
                    <Image
                      source={{ uri: b.coverUrl }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <BookOpen color={colors.textTertiary} size={22} />
                  )}
                  {status ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: colors.brandUi,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <StatusIcon status={status} />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {b.title}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusIcon({ status }: { status: W.ShelfStatus }) {
  if (status === 'finished') return <CheckCircle color="#fff" size={12} weight="fill" />
  if (status === 'reading') return <Clock color="#fff" size={12} weight="regular" />
  return <Bookmark color="#fff" size={12} weight="regular" />
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <Text
      style={{
        fontFamily: Fonts.uiMedium,
        fontSize: 11,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 18,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  )
}
