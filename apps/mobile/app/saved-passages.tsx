import { useDeleteAnnotation, useMyAnnotations, useUpdateAnnotation } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  CaretLeft,
  Trash,
  ShareNetwork,
  PencilSimple,
  Check,
  BookOpen,
} from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

// Saved Passages, the merged Highlights + Commonplace view per task.md
// Section 2a. Pulls every highlight where a note has been written, grouped
// by book, with public toggle + share + delete.

export default function SavedPassagesScreen() {
  const colors = useColors()
  const router = useRouter()
  const highlights = useMyAnnotations(['highlight'])
  const rows = useMemo(() => (highlights.data ?? []).filter((h) => h.body), [highlights.data])
  const loading = highlights.isPending
  const update = useUpdateAnnotation()
  const del = useDeleteAnnotation()
  const [editing, setEditing] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  // Group by book title for the section headers, entries without a book
  // bucket into "Loose pages".
  const grouped = useMemo(() => {
    const m = new Map<string, W.MyAnnotation[]>()
    for (const r of rows) {
      const key = r.bookTitle ?? r.sourceTitle ?? 'Loose pages'
      const list = m.get(key) ?? []
      list.push(r)
      m.set(key, list)
    }
    return Array.from(m.entries())
  }, [rows])

  // Edits patch the cached list at once and roll back if the server refuses them.
  const onTogglePublic = useCallback(
    (entry: W.MyAnnotation) => {
      if (!entry.bookId) return
      update.fire({ bookId: entry.bookId, id: entry.id, visibility: entry.visibility === 'public' ? 'private' : 'public' })
    },
    [update],
  )

  const onSaveNote = useCallback(
    (entry: W.MyAnnotation) => {
      setEditing(null)
      if (entry.bookId) update.fire({ bookId: entry.bookId, id: entry.id, body: noteDraft.trim() || null })
    },
    [noteDraft, update],
  )

  const onDelete = useCallback(
    (entry: W.MyAnnotation) => {
      Alert.alert('Delete passage?', (entry.selectedText ?? '').slice(0, 120), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (entry.bookId) del.fire({ bookId: entry.bookId, id: entry.id })
          },
        },
      ])
    },
    [del],
  )

  function colorSwatchFor(c: string | null): string {
    switch (c) {
      case 'amber': return colors.hlAmberT
      case 'auburn': return colors.hlAuburnT
      case 'yellow': return colors.hlYellowT
      case 'sage': return colors.hlSageT
      case 'cobalt': return colors.hlCobaltT
      case 'crimson': return colors.hlCrimsonT
      case 'purple': return colors.hlPurpleT
      default: return colors.borderDefault
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
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
          Saved Passages
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brandUi} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <BookOpen color={colors.textTertiary} size={28} />
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 14,
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: 12,
            }}
          >
            Add a note to a highlight while reading to save it here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {grouped.map(([title, entries]) => (
            <View key={title} style={{ marginBottom: 18 }}>
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
                {title}
              </Text>
              {entries.map((e) => (
                <View
                  key={e.id}
                  className="flex-row mb-2 rounded-2xl overflow-hidden border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <View style={{ width: 4, backgroundColor: colorSwatchFor(e.color) }} />
                  <View style={{ flex: 1, padding: 12 }}>
                    <Text
                      style={{
                        fontFamily: Fonts.bodyItalic,
                        fontSize: 14,
                        color: colors.textPrimary,
                        lineHeight: 21,
                      }}
                    >
                      "{e.selectedText}"
                    </Text>
                    {editing === e.id ? (
                      <View
                        style={{
                          marginTop: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <TextInput
                          value={noteDraft}
                          onChangeText={setNoteDraft}
                          autoFocus
                          placeholder="Note (optional)"
                          placeholderTextColor={colors.textTertiary}
                          style={{
                            flex: 1,
                            fontFamily: Fonts.body,
                            fontSize: 13,
                            color: colors.textPrimary,
                            backgroundColor: colors.bgBase,
                            borderColor: colors.borderSubtle,
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                          onSubmitEditing={() => onSaveNote(e)}
                        />
                        <Pressable
                          onPress={() => onSaveNote(e)}
                          accessibilityRole="button"
                          accessibilityLabel="Save note"
                          style={{
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: colors.brandUi,
                          }}
                        >
                          <Check color={colors.textOnBrand} size={14} weight="bold" />
                        </Pressable>
                      </View>
                    ) : e.body ? (
                      <Pressable
                        onPress={() => {
                          setNoteDraft(e.body ?? '')
                          setEditing(e.id)
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Edit note"
                      >
                        <Text
                          style={{
                            fontFamily: Fonts.body,
                            fontSize: 13,
                            color: colors.textSecondary,
                            marginTop: 6,
                            fontStyle: 'italic',
                          }}
                        >
                          ✎ {e.body}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setNoteDraft('')
                          setEditing(e.id)
                        }}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel="Add a note"
                        className="flex-row items-center mt-2"
                        style={{ gap: 4 }}
                      >
                        <PencilSimple color={colors.textTertiary} size={11} />
                        <Text
                          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary }}
                        >
                          Add a note
                        </Text>
                      </Pressable>
                    )}
                    <View
                      className="flex-row items-center justify-between"
                      style={{ marginTop: 10 }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.mono,
                          fontSize: 10,
                          color: colors.textTertiary,
                        }}
                      >
                        {new Date(e.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <View className="flex-row items-center" style={{ gap: 14 }}>
                        <View className="flex-row items-center gap-1">
                          <Text
                            style={{
                              fontFamily: Fonts.ui,
                              fontSize: 11,
                              color: colors.textTertiary,
                            }}
                          >
                            Public
                          </Text>
                          <Switch
                            value={e.visibility === 'public'}
                            onValueChange={() => onTogglePublic(e)}
                            trackColor={{ false: colors.bgDisabled, true: colors.toggleOn }}
                            accessibilityLabel="Public passage toggle"
                          />
                        </View>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/quote-card',
                              params: {
                                type: 'quote',
                                bookId: e.bookId ?? '',
                                bookTitle: e.bookTitle ?? '',
                                author: e.bookAuthor ?? '',
                                passageText: e.selectedText ?? '',
                              },
                            } as never)
                          }
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="Share as quote card"
                        >
                          <ShareNetwork color={colors.brandText} size={14} />
                        </Pressable>
                        <Pressable
                          onPress={() => onDelete(e)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="Delete passage"
                        >
                          <Trash color={colors.error} size={14} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
