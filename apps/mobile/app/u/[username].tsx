import { useCloseFriend, useProfilePage } from '@foxing/client'
import type * as W from '@foxing/types'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, BookOpen, Lock } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { Avatar } from '@/components/feed/feed-row'
import { FollowButton } from '@/components/profile/follow-button'
import { Divider, StatTile } from '@/components/profile/stat-tile'

// A reader's profile: the shared GET /u/:username page. A private profile shows only
// who it is; following and close-friend toggles patch this page in place.
export default function ProfileScreen() {
  const colors = useColors()
  const router = useRouter()
  const { username } = useLocalSearchParams<{ username: string }>()
  const query = useProfilePage(username ?? '')
  const page = query.data

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2" accessibilityLabel="Back">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}>
          Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {query.isPending ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={colors.brandUi} />
          </View>
        ) : !page ? (
          <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: 48 }}>
            No reader named @{username}.
          </Text>
        ) : page.isPrivate ? (
          <View className="items-center py-8">
            <Avatar profile={{ ...page.profile }} size={80} />
            <Text style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary, marginTop: 14 }}>
              {page.profile.displayName ?? page.profile.username}
            </Text>
            <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
              <Lock color={colors.textTertiary} size={14} />
              <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
                This profile is private.
              </Text>
            </View>
          </View>
        ) : (
          <PublicProfile page={page} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function PublicProfile({ page }: { page: Extract<W.ProfilePage, { isPrivate: false }> }) {
  const colors = useColors()
  const router = useRouter()
  const closeFriend = useCloseFriend()
  const { profile } = page
  const openBook = (slug: string) => router.push(`/book/${slug}` as never)

  return (
    <>
      <View className="items-center mb-6">
        <Avatar profile={profile} size={80} />
        <Text style={{ fontFamily: Fonts.displayBold, fontSize: 22, color: colors.textPrimary, marginTop: 14 }}>
          {profile.displayName ?? profile.username}
        </Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
          @{profile.username}
        </Text>
        {profile.bio ? (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 10,
              textAlign: 'center',
              lineHeight: 20,
              paddingHorizontal: 16,
            }}
          >
            {profile.bio}
          </Text>
        ) : null}
        {!page.isOwner ? (
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
            <FollowButton userId={profile.id} isFollowing={page.isFollowing} />
            {page.isFollowing ? (
              <Pressable
                onPress={() => closeFriend.fire({ userId: profile.id, on: !page.viewerHasAsCloseFriend })}
                accessibilityRole="switch"
                accessibilityState={{ checked: page.viewerHasAsCloseFriend }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: page.viewerHasAsCloseFriend ? colors.borderBrand : colors.borderInteractive,
                  backgroundColor: page.viewerHasAsCloseFriend ? colors.bgSelected : colors.bgSurface,
                }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary, fontSize: 13 }}>
                  {page.viewerHasAsCloseFriend ? 'Close friend' : 'Add to close friends'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View
        className="flex-row mb-6 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
        style={{ paddingVertical: 14 }}
      >
        <StatTile value={page.booksRead} label="Books" />
        <Divider />
        <StatTile value={page.highlightCount} label="Highlights" />
        <Divider />
        <StatTile
          value={page.followingCount}
          label="Following"
          onPress={page.isOwner ? () => router.push('/follows?tab=following' as never) : undefined}
        />
        <Divider />
        <StatTile
          value={page.followerCount}
          label="Followers"
          onPress={page.isOwner ? () => router.push('/follows?tab=followers' as never) : undefined}
        />
      </View>

      {page.currentlyReading.length > 0 ? (
        <Section title="Currently reading">
          {page.currentlyReading.map((b) => (
            <Pressable
              key={b.bookId}
              onPress={() => openBook(b.slug)}
              accessibilityRole="link"
              className="flex-row rounded-2xl p-3 mb-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Cover uri={b.coverUrl} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }} numberOfLines={2}>
                  {b.title}
                </Text>
                <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
                  {b.author}
                </Text>
                <View style={{ marginTop: 10, height: 4, borderRadius: 2, backgroundColor: colors.bgSunken }}>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.brandUi,
                      width: `${Math.max(0, Math.min(100, Math.round(b.progressPct)))}%`,
                    }}
                  />
                </View>
              </View>
            </Pressable>
          ))}
        </Section>
      ) : null}

      <BookStrip title="Favorites" books={page.favorites} onOpen={openBook} />
      <BookStrip title="Finished" books={page.finishedBooks} onOpen={openBook} />

      {page.publicHighlights.length > 0 ? (
        <Section title="Highlights">
          {page.publicHighlights.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => h.bookSlug && openBook(h.bookSlug)}
              className="p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{ fontFamily: Fonts.bodyItalic, fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}
                numberOfLines={4}
              >
                "{h.selectedText}"
              </Text>
              {h.bookTitle ? (
                <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 6 }} numberOfLines={1}>
                  {h.bookTitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </Section>
      ) : null}

      {page.lists.length > 0 ? (
        <Section title="Lists">
          {page.lists.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/lists/${l.id}` as never)}
              accessibilityRole="link"
              className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>
                {l.title}
              </Text>
              {l.description ? (
                <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={2}>
                  {l.description}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </Section>
      ) : null}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

function BookStrip({ title, books, onOpen }: { title: string; books: W.ProfileBook[]; onOpen: (slug: string) => void }) {
  const colors = useColors()
  if (books.length === 0) return null
  return (
    <Section title={title}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {books.map((b) => (
          <Pressable
            key={b.bookId}
            onPress={() => onOpen(b.slug)}
            accessibilityRole="link"
            accessibilityLabel={`${b.title} by ${b.author}`}
            style={{ width: 84 }}
          >
            <Cover uri={b.coverUrl} width={84} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textPrimary, marginTop: 4 }} numberOfLines={2}>
              {b.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Section>
  )
}

function Cover({ uri, width = 56 }: { uri: string | null; width?: number }) {
  const colors = useColors()
  return (
    <View
      style={{
        width,
        height: width * 1.5,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: colors.bgSunken,
        marginRight: width === 56 ? 12 : 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <BookOpen color={colors.textTertiary} size={20} />
      )}
    </View>
  )
}
