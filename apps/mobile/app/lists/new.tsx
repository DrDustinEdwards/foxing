import { useCreateList } from '@foxing/client'
import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, Eye, EyeSlash } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

export default function NewListScreen() {
  const colors = useColors()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const create = useCreateList()
  const saving = create.pending

  async function save() {
    if (!title.trim()) return
    const res = await create.run({
      title: title.trim().slice(0, 80),
      description: description.trim() || null,
      isPublic,
    })
    if (!res) {
      Alert.alert('Could not create the list', 'Check your connection and try again.')
      return
    }
    router.replace(`/lists/${res.list.id}` as never)
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
          New list
        </Text>
        <Pressable
          onPress={save}
          disabled={saving || !title.trim()}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: title.trim() ? colors.brandUi : colors.bgDisabled,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.textOnBrand} size="small" />
          ) : (
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Create
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.textTertiary}
          maxLength={80}
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 16,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
        />
        <Pressable
          onPress={() => setIsPublic((v) => !v)}
          className="flex-row items-center gap-3 p-3 rounded-xl border border-border-subtle-light dark:border-border-subtle-dark"
        >
          {isPublic ? (
            <Eye color={colors.info} size={18} />
          ) : (
            <EyeSlash color={colors.textTertiary} size={18} />
          )}
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          >
            {isPublic ? 'Public list' : 'Private to you'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
