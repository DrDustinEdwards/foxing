import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { CaretLeft } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface BookHit {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
}

const FOXING_API = 'https://foxing.app'

export default function ScanScreen() {
  const colors = useColors()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(true)
  const [manualIsbn, setManualIsbn] = useState('')
  const [book, setBook] = useState<BookHit | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const detected = useRef(false)

  useEffect(() => {
    if (!permission) return
    if (!permission.granted && permission.canAskAgain) {
      void requestPermission()
    }
  }, [permission, requestPermission])

  const lookup = useCallback(async (isbnRaw: string) => {
    const clean = isbnRaw.replace(/[^0-9Xx]/g, '')
    if (clean.length !== 10 && clean.length !== 13) {
      Alert.alert('Invalid ISBN', 'ISBN must be 10 or 13 digits.')
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch(`${FOXING_API}/api/books/lookup?isbn=${clean}`)
      const data = (await res.json()) as
        | { found: true; book: BookHit }
        | { found: false }
      if (data.found) {
        setBook(data.book)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      Alert.alert('Lookup failed', err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  const onBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (detected.current) return
      detected.current = true
      setScanning(false)
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      } catch {
        // haptics are best-effort
      }
      await lookup(data)
    },
    [lookup],
  )

  async function addToLibrary() {
    if (!book) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Sign in required')
      return
    }
    setAdding(true)
    const { error } = await supabase.from('user_books').upsert(
      {
        user_id: user.id,
        book_id: book.id,
        status: 'want_to_read',
      },
      { onConflict: 'user_id,book_id' },
    )
    setAdding(false)
    if (error) {
      Alert.alert('Could not add', error.message)
      return
    }
    Alert.alert('Added to library', `${book.title} was added to Want to Read.`, [
      { text: 'OK', onPress: () => router.back() },
    ])
  }

  function rescan() {
    setBook(null)
    setNotFound(false)
    detected.current = false
    setScanning(true)
  }

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark items-center justify-center">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
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
          }}
        >
          Scan a barcode
        </Text>
      </View>

      {permission.granted && scanning && !book && !notFound && !loading ? (
        <View style={{ flex: 1, position: 'relative' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8'],
            }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '40%',
              left: '10%',
              right: '10%',
              height: 120,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.7)',
              borderRadius: 12,
            }}
          />
          <Text
            style={{
              position: 'absolute',
              bottom: 24,
              left: 16,
              right: 16,
              textAlign: 'center',
              color: 'white',
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            Point the camera at the barcode on the back of the book.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          {!permission.granted ? (
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textSecondary,
                  marginBottom: 8,
                }}
              >
                Camera permission is required to scan barcodes. You can also
                enter the ISBN manually below.
              </Text>
              {permission.canAskAgain ? (
                <Pressable
                  onPress={requestPermission}
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.brandUi,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      color: colors.textOnBrand,
                      fontSize: 13,
                    }}
                  >
                    Allow camera
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <View
              className="items-center justify-center p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : null}

          {book ? (
            <View
              className="p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View className="flex-row">
                <View
                  style={{
                    width: 72,
                    height: 108,
                    borderRadius: 6,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                  }}
                >
                  {book.cover_url ? (
                    <Image
                      source={{ uri: book.cover_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 16,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {book.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 12,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {book.author}
                  </Text>
                </View>
              </View>
              <View className="flex-row" style={{ marginTop: 12, gap: 8 }}>
                <Pressable
                  onPress={addToLibrary}
                  disabled={adding}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: colors.brandUi,
                    opacity: adding ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      color: colors.textOnBrand,
                      fontSize: 13,
                    }}
                  >
                    Add to library
                  </Text>
                </Pressable>
                <Pressable
                  onPress={rescan}
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
                    Scan again
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {notFound ? (
            <View
              className="p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                  marginBottom: 6,
                }}
              >
                Book not in catalog.
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => router.push('/search' as never)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: colors.brandUi,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      color: colors.textOnBrand,
                      fontSize: 13,
                    }}
                  >
                    Search by title
                  </Text>
                </Pressable>
                <Pressable
                  onPress={rescan}
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
                    Try again
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            Or enter ISBN manually
          </Text>
          <View className="flex-row" style={{ gap: 8 }}>
            <TextInput
              value={manualIsbn}
              onChangeText={(t) => setManualIsbn(t.replace(/[^0-9Xx]/g, '').slice(0, 13))}
              keyboardType="number-pad"
              placeholder="9780000000000"
              placeholderTextColor={colors.textTertiary}
              maxLength={13}
              style={{
                flex: 1,
                fontFamily: Fonts.ui,
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
            <Pressable
              onPress={() => lookup(manualIsbn)}
              disabled={!manualIsbn || loading}
              style={{
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: manualIsbn ? colors.brandUi : colors.bgDisabled,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  color: colors.textOnBrand,
                  fontSize: 13,
                }}
              >
                Look up
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}
