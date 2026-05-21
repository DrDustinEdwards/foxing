import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, MagnifyingGlass, BookOpen, User } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface BookHit {
  id: string
  title: string
  author: string
  cover_url: string | null
}

interface FriendHit {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

export default function BuddyReadInviteScreen() {
  const colors = useColors()
  const router = useRouter()
  const [bookQuery, setBookQuery] = useState('')
  const [bookResults, setBookResults] = useState<BookHit[]>([])
  const [selectedBook, setSelectedBook] = useState<BookHit | null>(null)
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState<FriendHit[]>([])
  const [selectedFriend, setSelectedFriend] = useState<FriendHit | null>(null)
  const [creating, setCreating] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
    })()
  }, [])

  const searchBooks = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setBookResults([])
      return
    }
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url')
      .ilike('title', `%${q.trim()}%`)
      .limit(10)
    setBookResults(((data ?? []) as BookHit[]) ?? [])
  }, [])

  const searchFriends = useCallback(
    async (q: string) => {
      if (!userId) return
      if (q.trim().length < 2) {
        setFriendResults([])
        return
      }
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
      const followingIds = ((follows as { following_id: string }[] | null) ?? [])
        .map((r) => r.following_id)
      if (followingIds.length === 0) {
        setFriendResults([])
        return
      }
      const term = `%${q.trim()}%`
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', followingIds)
        .or(`display_name.ilike.${term},username.ilike.${term}`)
        .limit(10)
      setFriendResults(((data ?? []) as FriendHit[]) ?? [])
    },
    [userId],
  )

  useEffect(() => {
    const t = setTimeout(() => void searchBooks(bookQuery), 250)
    return () => clearTimeout(t)
  }, [bookQuery, searchBooks])

  useEffect(() => {
    const t = setTimeout(() => void searchFriends(friendQuery), 250)
    return () => clearTimeout(t)
  }, [friendQuery, searchFriends])

  async function startBuddyRead() {
    if (!userId || !selectedBook || !selectedFriend) return
    setCreating(true)
    const { data, error } = await supabase
      .from('buddy_reads')
      .insert({
        book_id: selectedBook.id,
        user1_id: userId,
        user2_id: selectedFriend.id,
      })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) {
      Alert.alert('Could not start', error?.message ?? 'Try again.')
      return
    }
    const id = (data as { id: string }).id
    router.replace(`/buddy-reads/${id}` as never)
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
            flex: 1,
          }}
        >
          Start a buddy read
        </Text>
        <Pressable
          onPress={startBuddyRead}
          disabled={creating || !selectedBook || !selectedFriend}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor:
              selectedBook && selectedFriend
                ? colors.brandUi
                : colors.bgDisabled,
          }}
        >
          {creating ? (
            <ActivityIndicator color={colors.textOnBrand} size="small" />
          ) : (
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Start
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          Book
        </Text>
        {selectedBook ? (
          <Pressable
            onPress={() => setSelectedBook(null)}
            className="flex-row p-3 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View
              style={{
                width: 40,
                height: 60,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: colors.bgSunken,
              }}
            >
              {selectedBook.cover_url ? (
                <Image
                  source={{ uri: selectedBook.cover_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <BookOpen color={colors.textTertiary} size={20} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
                numberOfLines={2}
              >
                {selectedBook.title}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
              >
                Tap to change
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <View
              className="flex-row items-center mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ paddingHorizontal: 12 }}
            >
              <MagnifyingGlass color={colors.textTertiary} size={18} />
              <TextInput
                value={bookQuery}
                onChangeText={setBookQuery}
                placeholder="Search books..."
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                  paddingVertical: 10,
                  marginLeft: 8,
                }}
              />
            </View>
            {bookResults.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  setSelectedBook(b)
                  setBookResults([])
                  setBookQuery('')
                }}
                className="flex-row p-2 mb-1 rounded-lg"
              >
                <View
                  style={{
                    width: 32,
                    height: 48,
                    borderRadius: 3,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                  }}
                >
                  {b.cover_url ? (
                    <Image
                      source={{ uri: b.cover_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>
                <View
                  style={{ flex: 1, marginLeft: 10, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 13,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                    }}
                    numberOfLines={1}
                  >
                    {b.author}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          Friend
        </Text>
        {selectedFriend ? (
          <Pressable
            onPress={() => setSelectedFriend(null)}
            className="flex-row items-center p-3 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: colors.brandSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedFriend.avatar_url ? (
                <Image
                  source={{ uri: selectedFriend.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <User color={colors.brandSubtleText} size={18} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
              >
                {selectedFriend.display_name ?? selectedFriend.username}
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 12,
                  color: colors.textTertiary,
                }}
              >
                Tap to change
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <View
              className="flex-row items-center mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ paddingHorizontal: 12 }}
            >
              <MagnifyingGlass color={colors.textTertiary} size={18} />
              <TextInput
                value={friendQuery}
                onChangeText={setFriendQuery}
                placeholder="Search people you follow..."
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                  paddingVertical: 10,
                  marginLeft: 8,
                }}
              />
            </View>
            {friendResults.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  setSelectedFriend(f)
                  setFriendResults([])
                  setFriendQuery('')
                }}
                className="flex-row items-center p-2 mb-1 rounded-lg"
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {f.avatar_url ? (
                    <Image
                      source={{ uri: f.avatar_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <User color={colors.brandSubtleText} size={16} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 13,
                      color: colors.textPrimary,
                    }}
                  >
                    {f.display_name ?? f.username}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                    }}
                  >
                    @{f.username}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
