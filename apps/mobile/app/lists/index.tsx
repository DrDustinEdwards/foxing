import { useMyLists } from '@foxing/client'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Plus, Eye, EyeSlash } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// The reader's own lists from GET /lists; a create or delete elsewhere patches this.
export default function MyListsScreen() {
  const colors = useColors()
  const router = useRouter()
  const lists = useMyLists()
  const rows = lists.data ?? []

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
          My lists
        </Text>
        <Pressable
          onPress={() => router.push('/lists/new' as never)}
          hitSlop={10}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="New list"
        >
          <Plus color={colors.brandUi} size={22} weight="bold" />
        </Pressable>
      </View>

      {lists.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
            }}
          >
            {lists.error ? 'Could not load your lists.' : 'No lists yet. Create one to start curating.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {rows.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/lists/${l.id}` as never)}
              className="p-4 mb-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View
                className="flex-row items-center"
                style={{ gap: 8, marginBottom: 4 }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: Fonts.uiMedium,
                    fontSize: 15,
                    color: colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {l.title}
                </Text>
                {l.isPublic ? (
                  <Eye color={colors.info} size={14} />
                ) : (
                  <EyeSlash color={colors.textTertiary} size={14} />
                )}
              </View>
              {l.description ? (
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginBottom: 6,
                  }}
                  numberOfLines={1}
                >
                  {l.description}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                }}
              >
                {l.bookCount} book{l.bookCount === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
