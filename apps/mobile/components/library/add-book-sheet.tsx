import { useSetBookStatus } from '@foxing/client'
import type * as W from '@foxing/types'
import { useColors } from '@/constants/colors'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Fonts } from '@/constants/fonts'
import { Compass, LinkSimple } from 'phosphor-react-native'

export function AddBookSheet({
  visible,
  onClose,
  onBrowse,
  onMatch,
}: {
  visible: boolean
  onClose: () => void
  onBrowse: () => void
  onMatch: (slug: string) => void
}) {
  const colors = useColors()
  // Two-step sheet: 'choose' shows the three actions; 'url' swaps in a text
  // input + lookup result. Keeping it inside the same modal avoids modal
  // stacking jank on Android.
  const [mode, setMode] = useState<'choose' | 'url'>('choose')
  const [url, setUrl] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const setStatus = useSetBookStatus()

  useEffect(() => {
    if (!visible) {
      // Reset to the chooser whenever the sheet closes so the next open
      // starts fresh instead of remembering the previous URL search state.
      setMode('choose')
      setUrl('')
      setLookupBusy(false)
      setLookupError(null)
    }
  }, [visible])

  const submitUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed || lookupBusy) return
    setLookupBusy(true)
    setLookupError(null)
    try {
      const title = titleFromBookUrl(trimmed)
      const match = title
        ? (await api.get<W.SearchPage>(`/search?q=${encodeURIComponent(title)}`)).books[0]
        : undefined
      if (!match) {
        setLookupError("This book isn't in the Foxing catalog yet.")
        return
      }
      // Add it to Want to Read, then open its page so the reader can start it.
      setStatus.fire({ bookId: match.id, status: 'want', book: match })
      onMatch(match.slug)
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Lookup failed.')
    } finally {
      setLookupBusy(false)
    }
  }, [lookupBusy, onMatch, setStatus, url])

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      header={
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          {mode === 'url' ? 'Add from URL' : 'Add a book'}
        </Text>
      }
    >
          {mode === 'choose' ? (
            <>
              <AddOption
                Icon={Compass}
                label="Browse catalog"
                subtitle="Public-domain classics from Gutenberg + Standard Ebooks"
                onPress={onBrowse}
              />
              <AddOption
                Icon={LinkSimple}
                label="Add from URL"
                subtitle="Paste a Standard Ebooks, Goodreads or Open Library link"
                onPress={() => setMode('url')}
                topBorder
              />
            </>
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="Paste a link to a book"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="search"
                onSubmitEditing={submitUrl}
                editable={!lookupBusy}
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgBase,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 10,
                }}
              />
              {lookupError ? (
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginBottom: 10,
                  }}
                >
                  {lookupError}
                </Text>
              ) : null}
              <View className="flex-row justify-end" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setMode('choose')}
                  className="px-4 py-2"
                  disabled={lookupBusy}
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textSecondary }}>
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  onPress={submitUrl}
                  disabled={lookupBusy || !url.trim()}
                  className="px-4 py-2 rounded-full"
                  style={{
                    backgroundColor: url.trim() ? colors.brandUi : colors.bgDisabled,
                    opacity: lookupBusy ? 0.7 : 1,
                  }}
                >
                  {lookupBusy ? (
                    <ActivityIndicator color={colors.textOnBrand} size="small" />
                  ) : (
                    <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>
                      Find
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
    </SheetScaffold>
  )
}

// Single row in the chooser, extracted so the three options share their
// layout and the three Pressables in the parent stay readable.
function AddOption({
  Icon,
  label,
  subtitle,
  onPress,
  topBorder,
}: {
  Icon: React.ComponentType<{ color: string; size: number }>
  label: string
  subtitle: string
  onPress: () => void
  topBorder?: boolean
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-4"
      style={topBorder ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : undefined}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.brandSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Icon color={colors.brandUi} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
          {label}
        </Text>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

// The book's title from a Standard Ebooks (/ebooks/{author}/{title}), Open Library
// (/works/OL...W/{Title}) or Goodreads (/book/show/{id}.{Title}) link,
// for a catalog search.
function titleFromBookUrl(input: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  let slug = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
  if (host.endsWith('goodreads.com')) slug = slug.replace(/^\d+[._-]/, '')
  const title = slug.replace(/\.html?$/i, '').replace(/[._-]+/g, ' ').trim()
  return title && !/^\d+$/.test(title) ? title : null
}
