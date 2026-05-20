import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Eye, EyeSlash, Lock, Trash, Users } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

const REACTION_EMOJIS = ['cry', 'laugh', 'shock', 'rage', 'plead', 'mind', 'love', 'wink'] as const
const REACTION_CHARS: Record<(typeof REACTION_EMOJIS)[number], string> = {
  cry: '\u{1F62D}',
  laugh: '\u{1F602}',
  shock: '\u{1F631}',
  rage: '\u{1F624}',
  plead: '\u{1F97A}',
  mind: '\u{1F92F}',
  love: '❤️',
  wink: '\u{1F643}',
}
type ReactionKey = (typeof REACTION_EMOJIS)[number]
type Privacy = 'public' | 'close_friends' | 'private'

interface OwnReaction {
  id: string
  chapter_name: string
  emoji: string
  note: string | null
  privacy: Privacy
  created_at: string
}

interface CommunityReaction {
  id: string
  chapter_name: string
  emoji: string
  created_at: string
}

interface Props {
  bookId: string
  progressPercentage: number | null
  inLibrary: boolean
}

function emojiKeyOf(c: string): ReactionKey | null {
  for (const k of REACTION_EMOJIS) {
    if (REACTION_CHARS[k] === c) return k
  }
  return null
}

export function ChapterReactionsSection({
  bookId,
  progressPercentage,
  inLibrary,
}: Props) {
  const colors = useColors()
  const [userId, setUserId] = useState<string | null>(null)
  const [own, setOwn] = useState<OwnReaction[]>([])
  const [community, setCommunity] = useState<CommunityReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [chapter, setChapter] = useState('')
  const [emoji, setEmoji] = useState<ReactionKey | null>(null)
  const [note, setNote] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>('public')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    const [ownRes, pubRes] = await Promise.all([
      user
        ? supabase
            .from('chapter_reactions')
            .select('id, chapter_name, emoji, note, privacy, created_at')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as OwnReaction[] }),
      supabase
        .from('chapter_reactions')
        .select('id, chapter_name, emoji, created_at')
        .eq('book_id', bookId)
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setOwn(((ownRes.data as OwnReaction[] | null) ?? []))
    setCommunity(((pubRes.data as CommunityReaction[] | null) ?? []))
    setLoading(false)
  }, [bookId])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { earliest: string; counts: Map<string, number> }
    >()
    for (const r of community) {
      const entry = map.get(r.chapter_name)
      if (!entry) {
        map.set(r.chapter_name, {
          earliest: r.created_at,
          counts: new Map([[r.emoji, 1]]),
        })
      } else {
        if (r.created_at < entry.earliest) entry.earliest = r.created_at
        entry.counts.set(r.emoji, (entry.counts.get(r.emoji) ?? 0) + 1)
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[1].earliest.localeCompare(b[1].earliest))
      .map(([chapterName, info]) => ({
        chapter: chapterName,
        emojis: [...info.counts.entries()]
          .map(([em, count]) => ({ emoji: em, count }))
          .sort((a, b) => b.count - a.count),
      }))
  }, [community])

  const safeCutoff = useMemo(() => {
    if (!inLibrary) return grouped.length
    const p = progressPercentage ?? 0
    if (p >= 0.9) return grouped.length
    if (p >= 0.5) return Math.floor(grouped.length / 2)
    return 0
  }, [grouped.length, inLibrary, progressPercentage])

  async function submit() {
    if (!userId) {
      Alert.alert('Sign in required')
      return
    }
    if (!emoji || !chapter.trim()) return
    setSaving(true)
    const { error } = await supabase.from('chapter_reactions').insert({
      user_id: userId,
      book_id: bookId,
      chapter_name: chapter.trim().slice(0, 120),
      emoji: REACTION_CHARS[emoji],
      note: note.trim() || null,
      privacy,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setChapter('')
    setEmoji(null)
    setNote('')
    setPrivacy('public')
    void load()
  }

  async function removeReaction(id: string) {
    if (!userId) return
    const { error } = await supabase
      .from('chapter_reactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) {
      Alert.alert('Could not delete', error.message)
      return
    }
    setOwn((prev) => prev.filter((r) => r.id !== id))
    void load()
  }

  if (loading) {
    return (
      <View style={{ paddingVertical: 16 }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }

  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
        }}
      >
        Chapter reactions
      </Text>

      {own.length > 0 ? (
        <View style={{ marginBottom: 14 }}>
          {own.map((r) => (
            <View
              key={r.id}
              className="flex-row items-start p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <Text style={{ fontSize: 22, marginRight: 10 }}>{r.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 14,
                    color: colors.textPrimary,
                  }}
                >
                  {r.chapter_name}
                </Text>
                {r.note ? (
                  <Text
                    style={{
                      fontFamily: Fonts.body,
                      fontSize: 13,
                      color: colors.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    {r.note}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => removeReaction(r.id)} hitSlop={10}>
                <Trash color={colors.textTertiary} size={16} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View
        className="p-4 mb-4 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      >
        <TextInput
          value={chapter}
          onChangeText={setChapter}
          placeholder="Chapter (e.g. Chapter 12)"
          placeholderTextColor={colors.textTertiary}
          maxLength={120}
          style={{
            fontFamily: Fonts.body,
            fontSize: 14,
            color: colors.textPrimary,
            backgroundColor: colors.bgBase,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginBottom: 10,
          }}
        />
        <View
          className="flex-row flex-wrap"
          style={{ gap: 6, marginBottom: 10 }}
        >
          {REACTION_EMOJIS.map((k) => {
            const active = emoji === k
            return (
              <Pressable
                key={k}
                onPress={() => setEmoji(k)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: active ? colors.brandUi : colors.borderSubtle,
                  backgroundColor: active
                    ? colors.brandSubtle
                    : colors.bgBase,
                }}
                accessibilityRole="button"
                accessibilityLabel={`React with ${k}`}
              >
                <Text style={{ fontSize: 22 }}>{REACTION_CHARS[k]}</Text>
              </Pressable>
            )
          })}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional note"
          placeholderTextColor={colors.textTertiary}
          maxLength={280}
          multiline
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textPrimary,
            backgroundColor: colors.bgBase,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            minHeight: 48,
            textAlignVertical: 'top',
            marginBottom: 10,
          }}
        />
        <View className="flex-row" style={{ gap: 6, marginBottom: 12 }}>
          {(['public', 'close_friends', 'private'] as Privacy[]).map((p) => {
            const active = privacy === p
            const Icon = p === 'public' ? Eye : p === 'close_friends' ? Users : Lock
            return (
              <Pressable
                key={p}
                onPress={() => setPrivacy(p)}
                className="flex-row items-center"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.brandUi : colors.borderSubtle,
                  backgroundColor: active
                    ? colors.brandSubtle
                    : colors.bgSurface,
                  gap: 4,
                }}
              >
                <Icon
                  color={active ? colors.brandSubtleText : colors.textTertiary}
                  size={14}
                />
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: active ? colors.brandSubtleText : colors.textTertiary,
                    textTransform: 'capitalize',
                  }}
                >
                  {p.replace('_', ' ')}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable
          onPress={submit}
          disabled={saving || !emoji || !chapter.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add reaction"
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor:
              emoji && chapter.trim() ? colors.brandUi : colors.bgDisabled,
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              color: colors.textOnBrand,
              fontSize: 13,
            }}
          >
            Add reaction
          </Text>
        </Pressable>
      </View>

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
        Community
      </Text>

      {grouped.length === 0 ? (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textTertiary,
          }}
        >
          No community reactions yet.
        </Text>
      ) : (
        grouped.map((g, i) => {
          const safe = i < safeCutoff
          return (
            <CommunityChapterRow
              key={g.chapter}
              chapter={g.chapter}
              emojis={g.emojis}
              safe={safe}
              colors={colors}
            />
          )
        })
      )}
    </View>
  )
}

function CommunityChapterRow({
  chapter,
  emojis,
  safe,
  colors,
}: {
  chapter: string
  emojis: Array<{ emoji: string; count: number }>
  safe: boolean
  colors: ReturnType<typeof useColors>
}) {
  const [revealed, setRevealed] = useState(safe)
  const show = safe || revealed
  return (
    <View
      className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 13,
          color: colors.textPrimary,
          marginBottom: 6,
        }}
      >
        {chapter}
      </Text>
      {show ? (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {emojis.map((e) => (
            <View
              key={e.emoji}
              className="flex-row items-center"
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: colors.bgSunken,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 4 }}>{e.emoji}</Text>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {e.count}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
            }}
          >
            Contains spoilers
          </Text>
          <Pressable
            onPress={() => setRevealed(true)}
            accessibilityRole="button"
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: colors.brandText,
              }}
            >
              Reveal anyway
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
