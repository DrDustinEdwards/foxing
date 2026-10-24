import { useCloseFriend, usePeople } from '@foxing/client'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, X as XIcon, Plus } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { PersonRow } from '@/components/profile/person-row'

// Close friends see what you share with friends only. They are chosen from the
// people you follow, as on the web People page; a toggle patches the list in place.
export default function CloseFriendsScreen() {
  const colors = useColors()
  const router = useRouter()
  const people = usePeople()
  const closeFriend = useCloseFriend()
  const friends = people.data?.closeFriends ?? []
  const candidates = (people.data?.following ?? []).filter((p) => !p.isClose)
  const open = (username: string) => router.push(`/u/${username}` as never)

  const toggle = (userId: string, on: boolean, label: string) => (
    <Pressable
      onPress={() => closeFriend.fire({ userId, on })}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={on ? `Add ${label} to close friends` : `Remove ${label} from close friends`}
      style={{ padding: 6 }}
    >
      {on ? <Plus color={colors.brandText} size={18} weight="bold" /> : <XIcon color={colors.textSecondary} size={18} />}
    </Pressable>
  )

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2" accessibilityLabel="Back">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text style={{ fontFamily: Fonts.displayBold, fontSize: 18, color: colors.textPrimary, marginLeft: 4 }}>
          Close Friends
        </Text>
      </View>
      <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 }}>
        Close friends see what you share with friends only.
      </Text>
      {people.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <Heading>Your close friends</Heading>
          {friends.length === 0 ? (
            <Note>Add people you trust from the readers you follow below.</Note>
          ) : (
            friends.map((f) => (
              <PersonRow
                key={f.id}
                person={f}
                onPress={() => open(f.username)}
                action={toggle(f.id, false, f.displayName ?? f.username)}
              />
            ))
          )}
          <View style={{ height: 18 }} />
          <Heading>Add from people you follow</Heading>
          {candidates.length === 0 ? (
            <Note>
              {friends.length > 0
                ? 'Everyone you follow is already a close friend.'
                : 'Follow a few readers first, then add them here.'}
            </Note>
          ) : (
            candidates.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                onPress={() => open(p.username)}
                action={toggle(p.id, true, p.displayName ?? p.username)}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
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
      {children}
    </Text>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View className="p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
      <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textTertiary }}>{children}</Text>
    </View>
  )
}
