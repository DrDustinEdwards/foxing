// Admin: lightweight catalog ops, find a book, fix its metadata, mark it
// hidden, or delete it. The full ingestion pipeline lives outside the app;
// this is the everyday cleanup surface.

import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CaretLeft, MagnifyingGlass, EyeSlash, Eye, Trash, FloppyDisk } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface BookRow {
  id: string
  title: string
  author: string
  cover_url: string | null
  is_hidden: boolean | null
  description: string | null
}

export default function CatalogScreen() {
  const colors = useColors()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<BookRow[]>([])
  const [searching, setSearching] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<{
    title: string
    author: string
    cover_url: string
    description: string
  } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      setRows([])
      return
    }
    setSearching(true)
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url, is_hidden, description')
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .limit(50)
    setRows(((data ?? []) as unknown) as BookRow[])
    setSearching(false)
  }, [query])

  useEffect(() => {
    // Pre-populate with most recent additions for context.
    ;(async () => {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url, is_hidden, description')
        .order('created_at', { ascending: false })
        .limit(20)
      setRows(((data ?? []) as unknown) as BookRow[])
    })()
  }, [])

  const startEdit = useCallback((b: BookRow) => {
    setEditingId(b.id)
    setEdit({
      title: b.title,
      author: b.author,
      cover_url: b.cover_url ?? '',
      description: b.description ?? '',
    })
  }, [])

  const saveEdit = useCallback(
    async (id: string) => {
      if (!edit) return
      setSavingId(id)
      const { error } = await supabase
        .from('books')
        .update({
          title: edit.title.trim() || undefined,
          author: edit.author.trim() || undefined,
          cover_url: edit.cover_url.trim() || null,
          description: edit.description.trim() || null,
        })
        .eq('id', id)
      if (!error) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  title: edit.title.trim() || r.title,
                  author: edit.author.trim() || r.author,
                  cover_url: edit.cover_url.trim() || null,
                  description: edit.description.trim() || null,
                }
              : r,
          ),
        )
        setEditingId(null)
        setEdit(null)
      } else {
        console.warn('[admin/catalog] save:', error.message)
      }
      setSavingId(null)
    },
    [edit],
  )

  const toggleHidden = useCallback(async (b: BookRow) => {
    const next = !b.is_hidden
    const { error } = await supabase.from('books').update({ is_hidden: next }).eq('id', b.id)
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === b.id ? { ...r, is_hidden: next } : r)))
    }
  }, [])

  const confirmDelete = useCallback((b: BookRow) => {
    Alert.alert(
      'Delete book?',
      `"${b.title}" by ${b.author}. This cannot be undone and will affect anyone who has it in their library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('books').delete().eq('id', b.id)
            if (!error) setRows((prev) => prev.filter((r) => r.id !== b.id))
          },
        },
      ],
    )
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2">
          <CaretLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 4,
          }}
        >
          Catalog management
        </Text>
      </View>

      <View className="px-4 pb-3">
        <View
          className="flex-row items-center"
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <MagnifyingGlass color={colors.textTertiary} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="Search title or author"
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              marginLeft: 8,
              paddingVertical: 10,
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          />
        </View>
      </View>

      {searching ? (
        <ActivityIndicator color={colors.brandUi} style={{ marginTop: 18 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 10 }}>
          {rows.map((b) => {
            const isEditing = editingId === b.id && edit
            return (
              <View
                key={b.id}
                className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <View className="flex-row">
                  <View
                    style={{
                      width: 56,
                      height: 80,
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: colors.bgSunken,
                    }}
                  >
                    {b.cover_url ? (
                      <Image source={{ uri: b.cover_url }} style={{ width: '100%', height: '100%' }} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    {isEditing ? (
                      <>
                        <TextInput
                          value={edit.title}
                          onChangeText={(t) => setEdit({ ...edit, title: t })}
                          placeholder="Title"
                          placeholderTextColor={colors.textTertiary}
                          style={editInputStyle(colors)}
                        />
                        <TextInput
                          value={edit.author}
                          onChangeText={(t) => setEdit({ ...edit, author: t })}
                          placeholder="Author"
                          placeholderTextColor={colors.textTertiary}
                          style={editInputStyle(colors)}
                        />
                        <TextInput
                          value={edit.cover_url}
                          onChangeText={(t) => setEdit({ ...edit, cover_url: t })}
                          placeholder="Cover URL"
                          placeholderTextColor={colors.textTertiary}
                          autoCapitalize="none"
                          style={editInputStyle(colors)}
                        />
                        <TextInput
                          value={edit.description}
                          onChangeText={(t) => setEdit({ ...edit, description: t })}
                          placeholder="Description"
                          placeholderTextColor={colors.textTertiary}
                          multiline
                          style={{ ...editInputStyle(colors), minHeight: 60 }}
                        />
                      </>
                    ) : (
                      <>
                        <Text
                          style={{
                            fontFamily: Fonts.uiMedium,
                            fontSize: 14,
                            color: colors.textPrimary,
                          }}
                          numberOfLines={2}
                        >
                          {b.title}
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
                          {b.author}
                        </Text>
                        {b.is_hidden ? (
                          <Text
                            style={{
                              fontFamily: Fonts.uiMedium,
                              fontSize: 10,
                              color: colors.warning ?? colors.textTertiary,
                              marginTop: 4,
                              textTransform: 'uppercase',
                              letterSpacing: 0.6,
                            }}
                          >
                            Hidden
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>

                <View
                  className="flex-row flex-wrap"
                  style={{ marginTop: 10, gap: 6 }}
                >
                  {isEditing ? (
                    <>
                      <CatalogAction
                        Icon={FloppyDisk}
                        label={savingId === b.id ? 'Saving…' : 'Save'}
                        onPress={() => saveEdit(b.id)}
                        primary
                      />
                      <CatalogAction
                        label="Cancel"
                        onPress={() => {
                          setEditingId(null)
                          setEdit(null)
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <CatalogAction label="Edit" onPress={() => startEdit(b)} />
                      <CatalogAction
                        Icon={b.is_hidden ? Eye : EyeSlash}
                        label={b.is_hidden ? 'Unhide' : 'Hide'}
                        onPress={() => toggleHidden(b)}
                      />
                      <CatalogAction
                        Icon={Trash}
                        label="Delete"
                        onPress={() => confirmDelete(b)}
                        destructive
                      />
                    </>
                  )}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function CatalogAction({
  label,
  Icon,
  onPress,
  primary,
  destructive,
}: {
  label: string
  Icon?: React.ComponentType<{ color: string; size: number }>
  onPress: () => void
  primary?: boolean
  destructive?: boolean
}) {
  const colors = useColors()
  const bg = primary ? colors.brandUi : 'transparent'
  const text = primary ? colors.textOnBrand : destructive ? colors.error : colors.textPrimary
  const border = primary ? 'transparent' : destructive ? colors.error : colors.borderInteractive
  return (
    <Pressable
      onPress={onPress}
      className="px-3 py-1 rounded-full border flex-row items-center"
      style={{ backgroundColor: bg, borderColor: border, gap: 4 }}
    >
      {Icon ? <Icon color={text} size={12} /> : null}
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: text }}>{label}</Text>
    </Pressable>
  )
}

function editInputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgBase,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  }
}
