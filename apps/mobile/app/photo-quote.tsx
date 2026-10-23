import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  CaretLeft,
  Camera,
  ImageSquare,
  Eye,
  EyeSlash,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { SITE_ORIGIN } from '@/constants/origins'

export default function PhotoQuoteScreen() {
  const colors = useColors()
  const router = useRouter()
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('image/jpeg')
  const [extracting, setExtracting] = useState(false)
  const [text, setText] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [note, setNote] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)

  async function pickImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Camera permission required')
        return
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Photo library permission required')
        return
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    setImageUri(asset.uri)
    setMimeType(asset.mimeType ?? 'image/jpeg')
  }

  async function extract() {
    if (!imageUri) return
    setExtracting(true)
    try {
      const formData = new FormData()
      // React Native FormData accepts an object with uri, name, and type.
      // Cast to any to bridge the DOM FormData type mismatch.
      ;(formData as unknown as { append: (k: string, v: unknown) => void }).append(
        'image',
        {
          uri: imageUri,
          name: 'page.jpg',
          type: mimeType,
        },
      )
      const res = await fetch(`${SITE_ORIGIN}/api/ai/extract-quote`, {
        method: 'POST',
        body: formData as unknown as BodyInit,
      })
      const data = (await res.json()) as { text?: string; error?: string }
      if (!res.ok || data.error) {
        Alert.alert(
          'Extraction failed',
          data.error === 'not_configured'
            ? 'AI extraction is not available right now.'
            : 'Could not extract text.',
        )
        return
      }
      const extracted = (data.text ?? '').trim()
      if (!extracted) {
        Alert.alert('No readable text', 'Try a clearer photo.')
        return
      }
      setText(extracted)
    } catch (err) {
      Alert.alert(
        'Extraction failed',
        err instanceof Error ? err.message : 'Network error',
      )
    } finally {
      setExtracting(false)
    }
  }

  async function save() {
    if (!text.trim()) {
      Alert.alert('Add the passage text')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Sign in required')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('commonplace_book').insert({
      user_id: user.id,
      passage_text: text.trim().slice(0, 5000),
      book_title: bookTitle.trim() || null,
      note: note.trim() || null,
      is_public: isPublic,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    Alert.alert('Saved', 'Added to your commonplace book.', [
      { text: 'OK', onPress: () => router.back() },
    ])
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
          Photo to quote
        </Text>
        <Pressable
          onPress={save}
          disabled={saving || !text.trim()}
          className="px-4 py-2 rounded-full"
          style={{
            backgroundColor: text.trim() ? colors.brandUi : colors.bgDisabled,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              color: colors.textOnBrand,
              fontSize: 13,
            }}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!imageUri ? (
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={() => pickImage('camera')}
              className="flex-1 items-center p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ gap: 6 }}
            >
              <Camera color={colors.brandUi} size={28} weight="bold" />
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: colors.textPrimary,
                }}
              >
                Take photo
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pickImage('library')}
              className="flex-1 items-center p-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ gap: 6 }}
            >
              <ImageSquare color={colors.brandUi} size={28} weight="bold" />
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 13,
                  color: colors.textPrimary,
                }}
              >
                From library
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Image
              source={{ uri: imageUri }}
              style={{
                width: '100%',
                height: 200,
                borderRadius: 10,
                backgroundColor: colors.bgSunken,
              }}
              resizeMode="cover"
            />
            <View className="flex-row" style={{ marginTop: 10, gap: 8 }}>
              <Pressable
                onPress={extract}
                disabled={extracting}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: colors.brandUi,
                  opacity: extracting ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {extracting ? (
                  <ActivityIndicator color={colors.textOnBrand} size="small" />
                ) : null}
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    color: colors.textOnBrand,
                    fontSize: 13,
                  }}
                >
                  Extract text
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setImageUri(null)
                  setText('')
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.borderInteractive,
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    color: colors.textPrimary,
                    fontSize: 13,
                  }}
                >
                  Retake
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginTop: 8,
          }}
        >
          Passage
        </Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Extracted text will appear here. You can edit before saving."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={5000}
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 16,
            color: colors.textPrimary,
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            minHeight: 140,
            textAlignVertical: 'top',
          }}
        />

        <TextInput
          value={bookTitle}
          onChangeText={setBookTitle}
          placeholder="Book title (optional)"
          placeholderTextColor={colors.textTertiary}
          maxLength={200}
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
          }}
        />

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={colors.textTertiary}
          maxLength={500}
          multiline
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
            minHeight: 60,
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
            {isPublic ? 'Public on profile' : 'Private to you'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
