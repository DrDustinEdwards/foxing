import { useClubsIndex } from '@foxing/client'
import type * as W from '@foxing/types'
import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { UsersThree, Plus, BookOpen } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { CreateClubSheet } from '@/components/clubs/create-club-sheet'

type Tab = 'mine' | 'discover'

// The reader's clubs and public clubs to join, from GET /clubs.
export default function ClubsScreen() {
  const colors = useColors()
  const router = useRouter()
  const index = useClubsIndex()
  const [tab, setTab] = useState<Tab>('mine')
  const [createOpen, setCreateOpen] = useState(false)
  const loading = index.isPending

  const rows = (tab === 'mine' ? index.data?.mine : index.data?.discover) ?? []

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 22,
            color: colors.textPrimary,
          }}
        >
          Clubs
        </Text>
        <Pressable
          onPress={() => setCreateOpen(true)}
          accessibilityLabel="New club"
          className="flex-row items-center gap-1 px-3 py-2 rounded-full"
          style={{ backgroundColor: colors.brandUi }}
        >
          <Plus color={colors.textOnBrand} size={14} weight="bold" />
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textOnBrand }}>
            New
          </Text>
        </Pressable>
      </View>

      <View className="flex-row px-4 mb-3">
        {(['mine', 'discover'] as Tab[]).map((t) => {
          const active = tab === t
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="flex-1 py-2 items-center"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: active ? colors.borderInteractive : colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: active ? colors.brandText : colors.textTertiary,
                }}
              >
                {t === 'mine' ? 'My Clubs' : 'Discover'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ClubCard
              club={item}
              onPress={() => router.push(`/clubs/${item.id}` as never)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 64 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              refreshing={index.isRefetching}
              onRefresh={() => index.refetch()}
              tintColor={colors.brandUi}
              colors={[colors.brandUi]}
            />
          }
          ListEmptyComponent={
            <ClubsEmpty
              tab={tab}
              onCreate={() => setCreateOpen(true)}
            />
          }
        />
      )}

      <CreateClubSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(clubId) => {
          setCreateOpen(false)
          setTab('mine')
          router.push(`/clubs/${clubId}` as never)
        }}
      />
    </SafeAreaView>
  )
}

function ClubCard({ club, onPress }: { club: W.ClubCard; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      className="flex-row p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <View
        style={{
          width: 56,
          height: 80,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: colors.bgSunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {club.currentBook?.coverUrl ?? club.coverUrl ? (
          <Image
            source={{ uri: (club.currentBook?.coverUrl ?? club.coverUrl) as string }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <UsersThree color={colors.textTertiary} size={22} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}
          numberOfLines={2}
        >
          {club.name}
        </Text>
        {club.currentBook ? (
          <View className="flex-row items-center" style={{ marginTop: 4 }}>
            <BookOpen color={colors.textTertiary} size={12} />
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 12,
                color: colors.textTertiary,
                marginLeft: 4,
              }}
              numberOfLines={1}
            >
              {club.currentBook.title}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
              marginTop: 4,
            }}
          >
            No book yet
          </Text>
        )}
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: 6,
          }}
        >
          {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  )
}

function ClubsEmpty({
  tab,
  onCreate,
}: {
  tab: Tab
  onCreate: () => void
}) {
  const colors = useColors()
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 80,
        paddingBottom: 64,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSubtle,
          marginBottom: 16,
        }}
      >
        <UsersThree color={colors.brandSubtleText} size={32} weight="regular" />
      </View>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 18,
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {tab === 'mine' ? 'No clubs yet' : 'Nothing to discover'}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textTertiary,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 16,
        }}
      >
        {tab === 'mine'
          ? 'Start a club around a book you love, invite friends or open it to anyone.'
          : 'Public clubs will show up here as readers create them.'}
      </Text>
      {tab === 'mine' ? (
        <Pressable
          onPress={onCreate}
          className="flex-row items-center gap-1 px-4 py-2 rounded-full"
          style={{ backgroundColor: colors.brandUi }}
        >
          <Plus color={colors.textOnBrand} size={14} weight="bold" />
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 13 }}>
            Start a club
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
