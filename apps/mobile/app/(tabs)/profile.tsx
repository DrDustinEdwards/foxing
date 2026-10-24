import { useMe, useMyAnnotations, useProfilePage, useStats } from '@foxing/client'
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { SignOut, BookOpen, GearSix, Sparkle } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authClient, queryClient } from '@/lib/api'
import { EditProfileSheet } from '@/components/profile/edit-profile-sheet'
import { ProfileHeader } from '@/components/profile/profile-header'
import { FavoritesStrip } from '@/components/profile/favorites-strip'
import { RecentHighlightsSection } from '@/components/profile/recent-highlights-section'
import { Section } from '@/components/profile/profile-section'
import { Divider, StatTile } from '@/components/profile/stat-tile'
import { StatBlock, StatLine } from '@/components/profile/stat-block'
import { CompanionSheet } from '@/components/reader/companion-sheet'

// The reader's own profile: GET /me, their public profile page (the same one others
// see), reading stats and recent highlights. Edits patch the cached profile in place.
export default function ProfileScreen() {
  const colors = useColors()
  const router = useRouter()
  const me = useMe()
  const profile = me.data?.profile ?? null
  const page = useProfilePage(profile?.username ?? '').data
  const publicPage = page && !page.isPrivate ? page : null
  const stats = useStats().data
  const highlights = (useMyAnnotations(['highlight']).data ?? []).slice(0, 3)
  const [editing, setEditing] = useState(false)
  const [personalityOpen, setPersonalityOpen] = useState(false)
  const reading = publicPage?.currentlyReading[0] ?? null
  // The companion needs a book to anchor on: what they're reading, or last finished.
  const anchorBookId = reading?.bookId ?? publicPage?.finishedBooks[0]?.bookId ?? null

  const signOut = async () => {
    await authClient.signOut()
    queryClient.clear()
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-end px-3 pt-2">
        <Pressable
          onPress={() => router.push('/settings' as never)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={{ padding: 6 }}
        >
          <GearSix color={colors.textPrimary} size={22} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {!profile ? (
          <ActivityIndicator color={colors.brandUi} />
        ) : (
          <>
            <ProfileHeader profile={profile} onEdit={() => setEditing(true)} />

            <FavoritesStrip
              books={publicPage?.favorites ?? []}
              onOpen={(slug) => router.push(`/book/${slug}` as never)}
            />

            <View
              className="flex-row mb-6 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ paddingVertical: 14 }}
            >
              <StatTile
                value={publicPage?.booksRead ?? 0}
                label="Books"
                onPress={() => router.push('/(tabs)/library')}
              />
              <Divider />
              <StatTile
                value={publicPage?.highlightCount ?? 0}
                label="Highlights"
                onPress={() => router.push('/highlights' as never)}
              />
              <Divider />
              <StatTile
                value={publicPage?.followingCount ?? 0}
                label="Following"
                onPress={() => router.push('/follows?tab=following' as never)}
              />
              <Divider />
              <StatTile
                value={publicPage?.followerCount ?? 0}
                label="Followers"
                onPress={() => router.push('/follows?tab=followers' as never)}
              />
            </View>

            {anchorBookId ? (
              <Pressable
                onPress={() => setPersonalityOpen(true)}
                accessibilityRole="button"
                className="flex-row items-center"
                style={{
                  marginBottom: 24,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: colors.brandSubtle,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  gap: 10,
                }}
              >
                <Sparkle color={colors.brandSubtleText} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.brandSubtleText }}>
                    Your reading personality
                  </Text>
                  <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.brandSubtleText, marginTop: 2 }}>
                    What your reading says about you, written by the companion.
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {reading ? (
              <Section title="Currently Reading">
                <Pressable
                  onPress={() => router.push(`/reader/${reading.bookId}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue ${reading.title}`}
                  className="flex-row rounded-2xl p-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View
                    style={{
                      width: 56,
                      height: 84,
                      borderRadius: 6,
                      overflow: 'hidden',
                      backgroundColor: colors.bgSunken,
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {reading.coverUrl ? (
                      <Image source={{ uri: reading.coverUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <BookOpen color={colors.textTertiary} size={20} />
                    )}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }} numberOfLines={2}>
                      {reading.title}
                    </Text>
                    <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
                      {reading.author}
                    </Text>
                    <View style={{ marginTop: 10, height: 4, borderRadius: 2, backgroundColor: colors.bgSunken }}>
                      <View
                        style={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: colors.brandUi,
                          width: `${Math.max(0, Math.min(100, Math.round(reading.progressPct)))}%`,
                        }}
                      />
                    </View>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
                      {Math.round(reading.progressPct)}%
                    </Text>
                  </View>
                </Pressable>
              </Section>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Saved Passages', href: '/saved-passages' },
                { label: 'Timeline', href: '/reading-timeline' },
                { label: 'Year in Reading', href: '/year-in-reading' },
                { label: 'Vocabulary', href: '/vocabulary' },
              ].map((l) => (
                <Pressable
                  key={l.href}
                  onPress={() => router.push(l.href as never)}
                  accessibilityRole="link"
                  className="px-3 py-2 rounded-full border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textPrimary }}>{l.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {stats ? (
              <Section title="Reading Stats" actionLabel="View goals" onAction={() => router.push('/goals' as never)}>
                <View className="rounded-2xl p-4 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
                  <StatBlock heading="This Year">
                    <StatLine value={`${stats.finishedThisYear}`} label={stats.finishedThisYear === 1 ? 'book' : 'books'} />
                    <StatLine value={`${stats.streak.currentStreak}`} label="day streak" />
                  </StatBlock>
                  <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 14 }} />
                  <StatBlock heading="All Time">
                    <StatLine
                      value={`${stats.streak.totalBooksFinished}`}
                      label={stats.streak.totalBooksFinished === 1 ? 'book total' : 'books total'}
                    />
                    <StatLine
                      value={`${stats.streak.longestStreak}`}
                      label={stats.streak.longestStreak === 1 ? 'longest day' : 'longest days'}
                    />
                    <StatLine value={`${stats.streak.totalPagesRead}`} label="pages read" />
                  </StatBlock>
                </View>
              </Section>
            ) : null}

            {highlights.length > 0 ? (
              <RecentHighlightsSection highlights={highlights} onViewAll={() => router.push('/highlights' as never)} />
            ) : null}

            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Foxing"
              className="flex-row justify-center items-center gap-2 rounded-xl py-4 border border-border-subtle-light dark:border-border-subtle-dark bg-bg-surface-light dark:bg-bg-surface-dark"
            >
              <SignOut color={colors.error} size={16} />
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.error }}>Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {profile ? <EditProfileSheet visible={editing} profile={profile} onClose={() => setEditing(false)} /> : null}

      <CompanionSheet
        visible={personalityOpen}
        title="Your reading personality"
        eyebrow={profile?.displayName ?? profile?.username ?? ''}
        request={anchorBookId ? { action: 'reading_personality', bookId: anchorBookId } : null}
        onClose={() => setPersonalityOpen(false)}
      />
    </SafeAreaView>
  )
}
