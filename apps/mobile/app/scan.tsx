import { useClubsIndex, useSetBookStatus } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { CaretLeft } from 'phosphor-react-native'
import { resolveScannedIsbn, type ResolvedMeta } from '@/lib/scan-book'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { OutlineBtn, PrimaryBtn, Section } from '@/components/scan/scan-controls'

const STATUS_LABELS: Array<{ value: W.ShelfStatus; label: string }> = [
  { value: 'want', label: 'Want to read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
]

export default function ScanScreen() {
  const colors = useColors()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(true)
  const [manualIsbn, setManualIsbn] = useState('')
  const [book, setBook] = useState<W.BookCard | null>(null)
  const [resolved, setResolved] = useState<ResolvedMeta | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const setStatus = useSetBookStatus()
  const busy = setStatus.pending
  // Clubs the reader belongs to that are reading the scanned book right now.
  const readingClubs = (useClubsIndex().data?.mine ?? []).filter((c) => book && c.currentBook?.id === book.id)
  const detected = useRef(false)

  useEffect(() => {
    if (!permission) return
    if (!permission.granted && permission.canAskAgain) {
      void requestPermission()
    }
  }, [permission, requestPermission])

  const lookup = useCallback(async (isbnRaw: string) => {
    setLoading(true)
    setNotFound(false)
    setBook(null)
    setResolved(null)
    const res = await resolveScannedIsbn(isbnRaw)
    setLoading(false)
    if (!res.ok) {
      Alert.alert('Invalid ISBN', res.error)
      detected.current = false
      setScanning(true)
      return
    }
    setResolved(res.resolved)
    if (res.match) {
      setBook(res.match)
    } else {
      setNotFound(true)
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

  function rescan() {
    setBook(null)
    setResolved(null)
    setNotFound(false)
    detected.current = false
    setScanning(true)
  }

  async function handleAddToLibrary(status: W.ShelfStatus) {
    if (!book) return
    if (!(await setStatus.run({ bookId: book.id, status, book }))) {
      Alert.alert('Could not add', 'Check your connection and try again.')
      return
    }
    const label = STATUS_LABELS.find((s) => s.value === status)?.label ?? 'library'
    Alert.alert('Added to library', `${book.title} → ${label}.`)
  }

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark items-center justify-center">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    )
  }

  const showCamera =
    permission.granted && scanning && !book && !notFound && !loading

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

      {showCamera ? (
        <View style={{ flex: 1, position: 'relative' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8'] }}
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
              borderColor: colors.textOnDark,
              borderRadius: 12,
              opacity: 0.7,
            }}
          />
          <Text
            style={{
              position: 'absolute',
              bottom: 24,
              left: 16,
              right: 16,
              textAlign: 'center',
              color: colors.textOnDark,
              fontFamily: Fonts.uiMedium,
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            Point the camera at the barcode on the back of the book.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
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
            <View className="items-center justify-center p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
              <ActivityIndicator color={colors.brandUi} />
            </View>
          ) : null}

          {book ? (
            <View className="p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
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
                  {book.coverUrl ? (
                    <Image
                      source={{ uri: book.coverUrl }}
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

              {/* READ FREE: public-domain edition in the catalog. */}
              {book.readable ? (
                <Section colors={colors} label="Read free">
                  <PrimaryBtn
                    colors={colors}
                    label="Read now"
                    onPress={() => router.push(`/reader/${book.id}` as never)}
                  />
                </Section>
              ) : null}

              {/* LIBRARY: add with a status. */}
              <Section colors={colors} label="Add to your library">
                <View className="flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {STATUS_LABELS.map((s) => (
                    <OutlineBtn
                      key={s.value}
                      colors={colors}
                      label={s.label}
                      disabled={busy}
                      onPress={() => handleAddToLibrary(s.value)}
                    />
                  ))}
                </View>
              </Section>

              {/* CLUBS: where the reader's clubs are reading it now. */}
              {readingClubs.length > 0 ? (
                <Section colors={colors} label="Your clubs reading it">
                  <View className="flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {readingClubs.map((c) => (
                      <OutlineBtn
                        key={c.id}
                        colors={colors}
                        label={c.name}
                        onPress={() => router.push(`/clubs/${c.id}` as never)}
                      />
                    ))}
                  </View>
                </Section>
              ) : null}

              <View style={{ marginTop: 14 }}>
                <OutlineBtn colors={colors} label="Scan again" onPress={rescan} />
              </View>
            </View>
          ) : null}

          {notFound ? (
            <View className="p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 14,
                  color: colors.textPrimary,
                  marginBottom: 4,
                }}
              >
                We don&apos;t have this one yet.
              </Text>
              {resolved ? (
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginBottom: 8,
                  }}
                >
                  Scanned: {resolved.title}
                  {resolved.author ? ` · ${resolved.author}` : ''}
                </Text>
              ) : (
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginBottom: 8,
                  }}
                >
                  That barcode did not resolve to a known book.
                </Text>
              )}
              <View className="flex-row" style={{ gap: 8 }}>
                <PrimaryBtn
                  colors={colors}
                  label="Search by title"
                  onPress={() => router.push('/search' as never)}
                />
                <OutlineBtn colors={colors} label="Try again" onPress={rescan} />
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
              onChangeText={(t) =>
                setManualIsbn(t.replace(/[^0-9Xx]/g, '').slice(0, 13))
              }
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
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

