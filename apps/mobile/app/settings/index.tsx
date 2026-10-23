import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Share,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CaretLeft, Trash } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { reportWriteError } from '@/lib/db-write'
import { rescheduleAll } from '@/lib/local-notifications'
import { getHapticsEnabled, setHapticsEnabled } from '@/lib/haptics'
import {
  APP_LANGUAGE_OPTIONS,
  DEFAULT_USER_PREFS,
  type UserPrefs,
  getCalibratedWpm,
  getUserPrefs,
  setUserPrefs,
} from '@/lib/user-prefs'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { importFromStoryGraph } from '@/lib/import'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { SITE_ORIGIN } from '@/constants/origins'
import { LinkRow, MetaHeader, Section, SegmentedRow, TimeRow, ToggleRow } from '@/components/settings/settings-rows'
import { csvEscape, escapeIlike, mapShelf, parseGoodreadsCsv } from '@/lib/goodreads-import'

const APP_VERSION = '1.0.0'
const NOTIFICATION_PREFS_KEY = 'notification_prefs'
const READING_DEFAULTS_KEY = 'reading_defaults'
const ANON_HIGHLIGHTS_KEY = 'anonymous_highlights'
// Reader-adjacent accessibility prefs live here for now; the reader can
// pick them up later. Stored locally so we don't have to widen UserPrefs.
const A11Y_HIGH_CONTRAST_KEY = 'a11y_high_contrast'
const A11Y_REDUCE_MOTION_KEY = 'a11y_reduce_motion'
const TTS_SPEED_KEY = 'tts_speed'

type ProfileVisibility = 'public' | 'followers' | 'private'

interface NotificationPrefs {
  master: boolean
  dailyReminder: boolean
  reminderTime: string
  streakAtRisk: boolean
  newClubDiscussion: boolean
  someoneRepliedToComment: boolean
  newFollower: boolean
  badgeEarned: boolean
  friendFinishedBook: boolean
  quietStart: string
  quietEnd: string
}

// Per task.md Section 3h: only streak-risk is ON by default. Everything else
// is opt-in so a new user isn't ambushed with notifications they didn't ask
// for. The first-streak prompt (lib/streaks.ts) handles the daily reminder
// opt-in conversation separately.
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  master: true,
  dailyReminder: false,
  reminderTime: '20:00',
  streakAtRisk: true,
  newClubDiscussion: false,
  someoneRepliedToComment: false,
  newFollower: false,
  badgeEarned: false,
  friendFinishedBook: false,
  quietStart: '22:00',
  quietEnd: '08:00',
}

interface ReadingDefaults {
  font: 'source-serif' | 'georgia' | 'opendyslexic' | 'system-sans'
  size: 'S' | 'M' | 'L' | 'XL'
  theme: 'default' | 'sepia' | 'dark' | 'oled'
  keepAwake: boolean
}

const DEFAULT_READING_DEFAULTS: ReadingDefaults = {
  font: 'source-serif',
  size: 'M',
  theme: 'default',
  keepAwake: false,
}

export default function SettingsScreen() {
  const colors = useColors()
  const router = useRouter()

  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<ProfileVisibility>('public')
  const [progressPublic, setProgressPublic] = useState(true)
  const [anonHighlights, setAnonHighlights] = useState(false)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [readingDefaults, setReadingDefaults] = useState<ReadingDefaults>(DEFAULT_READING_DEFAULTS)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  // Which source the most recent import came from, drives the result modal
  // title so users see "StoryGraph import complete" instead of a generic message.
  const [importSource, setImportSource] = useState<'Goodreads' | 'StoryGraph'>('Goodreads')
  const [busy, setBusy] = useState(false)
  const [userPrefs, setUserPrefsState] = useState<UserPrefs>(DEFAULT_USER_PREFS)
  const [calibratedWpm, setCalibratedWpmState] = useState<number | null>(null)
  // New accessibility prefs (TTS speed, high contrast, reduce motion).
  // Stored as plain AsyncStorage so we don't have to widen UserPrefs.
  const [highContrast, setHighContrast] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      setEmail(user?.email ?? null)
      setUserId(user?.id ?? null)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_public, progress_is_public')
          .eq('id', user.id)
          .maybeSingle()
        const p = profile as
          | {
              is_public: boolean | string | null
              progress_is_public: boolean | null
            }
          | null
        if (p) {
          // is_public could be a boolean or a string enum in the schema.
          // tolerate both shapes.
          const v = p.is_public
          if (typeof v === 'string') setVisibility((v as ProfileVisibility) ?? 'public')
          else setVisibility(v === false ? 'private' : 'public')
          setProgressPublic(p.progress_is_public !== false)
        }
      }

      const [notif, defaults, anon, hc, rm, tts] = await Promise.all([
        AsyncStorage.getItem(NOTIFICATION_PREFS_KEY),
        AsyncStorage.getItem(READING_DEFAULTS_KEY),
        AsyncStorage.getItem(ANON_HIGHLIGHTS_KEY),
        AsyncStorage.getItem(A11Y_HIGH_CONTRAST_KEY),
        AsyncStorage.getItem(A11Y_REDUCE_MOTION_KEY),
        AsyncStorage.getItem(TTS_SPEED_KEY),
      ])
      if (notif) {
        try {
          setNotifPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(notif) })
        } catch { /* ignore */ }
      }
      if (defaults) {
        try {
          setReadingDefaults({ ...DEFAULT_READING_DEFAULTS, ...JSON.parse(defaults) })
        } catch { /* ignore */ }
      }
      if (anon === 'true') setAnonHighlights(true)
      if (hc === 'true') setHighContrast(true)
      if (rm === 'true') setReduceMotion(true)
      if (tts) {
        const parsed = parseFloat(tts)
        if (Number.isFinite(parsed) && parsed > 0) setTtsSpeed(parsed)
      }
      setHapticsOn(await getHapticsEnabled())
      setUserPrefsState(await getUserPrefs())
      setCalibratedWpmState(await getCalibratedWpm())
    })()
    return () => {
      mounted = false
    }
  }, [])

  // ── Persistence helpers ──────────────────────────────────────────────────
  const updateReadingDefaults = useCallback(async (next: ReadingDefaults) => {
    setReadingDefaults(next)
    await AsyncStorage.setItem(READING_DEFAULTS_KEY, JSON.stringify(next))
  }, [])

  const updateNotifPrefs = useCallback(async (next: NotificationPrefs) => {
    setNotifPrefs(next)
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next))
    // Re-program OS-level reminders to match. No-op on devices that don't
    // have expo-notifications yet (pre-1.0.1 build).
    rescheduleAll().catch(() => {})
  }, [])

  const updateVisibility = useCallback(
    async (v: ProfileVisibility) => {
      setVisibility(v)
      if (!userId) return
      // is_public is stored as either a boolean or a 3-value text enum in
      // the schema. Write the text value, Postgres will coerce to bool
      // when the column is boolean.
      const { error } = await supabase
        .from('profiles')
        .update({ is_public: v === 'private' ? false : v })
        .eq('id', userId)
      reportWriteError(error, { op: 'update', table: 'profiles', extra: { field: 'is_public' } })
    },
    [userId],
  )

  const updateProgressPublic = useCallback(
    async (value: boolean) => {
      setProgressPublic(value)
      if (!userId) return
      const { error } = await supabase
        .from('profiles')
        .update({ progress_is_public: value })
        .eq('id', userId)
      reportWriteError(error, { op: 'update', table: 'profiles', extra: { field: 'progress_is_public' } })
    },
    [userId],
  )

  const updateAnon = useCallback(async (value: boolean) => {
    setAnonHighlights(value)
    await AsyncStorage.setItem(ANON_HIGHLIGHTS_KEY, value ? 'true' : 'false')
  }, [])

  const updateUserPrefs = useCallback(async (next: UserPrefs) => {
    setUserPrefsState(next)
    await setUserPrefs(next)
  }, [])

  // ── Account actions ──────────────────────────────────────────────────────

  const exportData = useCallback(async () => {
    if (!userId || busy) return
    setBusy(true)
    try {
      const [ub, hl, vb] = await Promise.all([
        supabase
          .from('user_books')
          .select('book_id, status, rating, review, started_at, finished_at')
          .eq('user_id', userId),
        supabase
          .from('highlights')
          .select('book_id, cfi, text, color, created_at')
          .eq('user_id', userId),
        supabase
          .from('vocabulary')
          .select('book_id, word, context, created_at')
          .eq('user_id', userId),
      ])
      const csv = [
        '# Foxing data export',
        '',
        '## user_books',
        'book_id,status,rating,review,started_at,finished_at',
        ...((ub.data ?? []) as Array<Record<string, unknown>>).map(
          (r) =>
            [r.book_id, r.status, r.rating ?? '', csvEscape(r.review), r.started_at ?? '', r.finished_at ?? ''].join(','),
        ),
        '',
        '## highlights',
        'book_id,cfi,text,color,created_at',
        ...((hl.data ?? []) as Array<Record<string, unknown>>).map(
          (r) => [r.book_id, r.cfi, csvEscape(r.text), r.color ?? '', r.created_at].join(','),
        ),
        '',
        '## vocabulary',
        'book_id,word,context,created_at',
        ...((vb.data ?? []) as Array<Record<string, unknown>>).map(
          (r) => [r.book_id, csvEscape(r.word), csvEscape(r.context), r.created_at].join(','),
        ),
      ].join('\n')
      await Share.share({ message: csv })
    } finally {
      setBusy(false)
    }
  }, [busy, userId])

  const importGoodreads = useCallback(async () => {
    if (importBusy) return
    setImportResult(null)
    setImportSource('Goodreads')
    let pick: DocumentPicker.DocumentPickerResult
    try {
      pick = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      })
    } catch (e) {
      console.warn('[settings] document pick failed:', e instanceof Error ? e.message : e)
      return
    }
    if (pick.canceled) return
    const asset = pick.assets?.[0]
    if (!asset?.uri) return
    setImportBusy(true)
    try {
      const csv = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      })
      const rows = parseGoodreadsCsv(csv)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setImportBusy(false)
        return
      }
      let imported = 0
      let skipped = 0
      // Match each row against the books table by title+author ilike and
      // upsert a user_books row. Done sequentially, Goodreads exports are
      // usually under a few hundred rows so this isn't worth parallelizing.
      for (const r of rows) {
        if (!r.title) {
          skipped += 1
          continue
        }
        let q = supabase
          .from('books')
          .select('id')
          .ilike('title', `%${escapeIlike(r.title)}%`)
          .limit(1)
        if (r.author) q = q.ilike('author', `%${escapeIlike(r.author)}%`)
        const { data: match } = await q
        const bookId = ((match ?? [])[0] as { id?: string } | undefined)?.id
        if (!bookId) {
          skipped += 1
          continue
        }
        const status = mapShelf(r.shelf)
        const finishedIso = r.dateRead ? new Date(r.dateRead).toISOString() : null
        const { error } = await supabase.from('user_books').upsert(
          {
            user_id: user.id,
            book_id: bookId,
            status,
            rating: r.rating > 0 ? r.rating : null,
            review: r.review || null,
            finished_at: status === 'finished' ? finishedIso : null,
            started_at: status === 'reading' ? finishedIso ?? new Date().toISOString() : null,
          },
          { onConflict: 'user_id,book_id' },
        )
        if (error) {
          console.warn('[settings] import upsert failed:', error.message)
          skipped += 1
        } else {
          imported += 1
        }
      }
      setImportResult({ imported, skipped })
    } catch (e) {
      console.warn('[settings] goodreads parse failed:', e instanceof Error ? e.message : e)
    } finally {
      setImportBusy(false)
    }
  }, [importBusy])

  // Shared wrapper for the simpler CSV imports, picks a file, runs the
  // provided lib/import function against the signed-in user, surfaces a
  // result modal. The Goodreads importer above stays inline because its
  // parser + matching live in this file from before lib/import existed.
  const runCsvImport = useCallback(
    async (source: 'StoryGraph', fn: (uri: string, userId: string) => Promise<{ imported: number; skipped: number }>) => {
      if (importBusy) return
      setImportResult(null)
      setImportSource(source)
      let pick: DocumentPicker.DocumentPickerResult
      try {
        pick = await DocumentPicker.getDocumentAsync({
          type: ['text/csv', 'text/comma-separated-values', '*/*'],
          copyToCacheDirectory: true,
        })
      } catch (e) {
        console.warn('[settings] document pick failed:', e instanceof Error ? e.message : e)
        return
      }
      if (pick.canceled) return
      const asset = pick.assets?.[0]
      if (!asset?.uri) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setImportBusy(true)
      try {
        const result = await fn(asset.uri, user.id)
        setImportResult(result)
      } catch (e) {
        console.warn(`[settings] ${source} import failed:`, e instanceof Error ? e.message : e)
      } finally {
        setImportBusy(false)
      }
    },
    [importBusy],
  )

  const importStoryGraph = useCallback(
    () => runCsvImport('StoryGraph', importFromStoryGraph),
    [runCsvImport],
  )

  const deleteAccount = useCallback(() => {
    Alert.alert(
      'Delete your Foxing account?',
      'This permanently removes your profile, library, highlights, clubs, comments, and badges.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'This cannot be undone.',
              [
                { text: 'Keep account', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: async () => {
                    // Hard delete requires service-role privileges so it flows
                    // through an Edge Function. The handler verifies the JWT
                    // sub matches the userId in payload before deleting.
                    try {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (user) {
                        const { error } = await supabase.functions.invoke('ai-companion', {
                          body: { action: 'delete_account', payload: { userId: user.id } },
                        })
                        if (error) console.warn('[settings] delete_account:', error.message)
                      }
                    } catch (e) {
                      console.warn('[settings] delete_account threw:', e)
                    }
                    await supabase.auth.signOut()
                  },
                },
              ],
            )
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
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <MetaHeader>Reading</MetaHeader>

        <Section title="Defaults">
          <SegmentedRow
            label="Font"
            value={readingDefaults.font}
            options={[
              { value: 'source-serif', label: 'Serif' },
              { value: 'georgia', label: 'Georgia' },
              { value: 'opendyslexic', label: 'OpenDys' },
              { value: 'system-sans', label: 'Sans' },
            ]}
            onChange={(v) =>
              updateReadingDefaults({ ...readingDefaults, font: v as ReadingDefaults['font'] })
            }
          />
          <SegmentedRow
            label="Size"
            value={readingDefaults.size}
            options={(['S', 'M', 'L', 'XL'] as const).map((v) => ({ value: v, label: v }))}
            onChange={(v) =>
              updateReadingDefaults({ ...readingDefaults, size: v as ReadingDefaults['size'] })
            }
          />
          <SegmentedRow
            label="Theme"
            value={readingDefaults.theme}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'sepia', label: 'Sepia' },
              { value: 'dark', label: 'Dark' },
              { value: 'oled', label: 'OLED' },
            ]}
            onChange={(v) =>
              updateReadingDefaults({ ...readingDefaults, theme: v as ReadingDefaults['theme'] })
            }
          />
          <ToggleRow
            label="Keep screen awake while reading"
            value={readingDefaults.keepAwake}
            onChange={(v) => updateReadingDefaults({ ...readingDefaults, keepAwake: v })}
          />
          <ToggleRow
            label="Haptic feedback"
            sub="Subtle buzz on highlights, badges, and milestones"
            value={hapticsOn}
            onChange={async (v) => {
              setHapticsOn(v)
              await setHapticsEnabled(v)
            }}
          />
        </Section>

        <Section title="Accessibility">
          <SegmentedRow
            label="Text-to-speech speed"
            value={String(ttsSpeed) as '0.75' | '1' | '1.25' | '1.5'}
            options={[
              { value: '0.75', label: '0.75×' },
              { value: '1', label: '1×' },
              { value: '1.25', label: '1.25×' },
              { value: '1.5', label: '1.5×' },
            ]}
            onChange={async (v) => {
              const parsed = parseFloat(v)
              if (!Number.isFinite(parsed) || parsed <= 0) return
              setTtsSpeed(parsed)
              await AsyncStorage.setItem(TTS_SPEED_KEY, String(parsed))
            }}
          />
          <ToggleRow
            label="High contrast mode"
            sub="Stronger contrast for text and icons"
            value={highContrast}
            onChange={async (v) => {
              setHighContrast(v)
              await AsyncStorage.setItem(A11Y_HIGH_CONTRAST_KEY, v ? 'true' : 'false')
            }}
          />
          <ToggleRow
            label="Reduce motion"
            sub="Disable page-turn and other animations"
            value={reduceMotion}
            onChange={async (v) => {
              setReduceMotion(v)
              await AsyncStorage.setItem(A11Y_REDUCE_MOTION_KEY, v ? 'true' : 'false')
            }}
          />
        </Section>

        <Section title="Language">
          <SegmentedRow
            label="App language"
            value={userPrefs.appLanguage}
            options={APP_LANGUAGE_OPTIONS}
            onChange={(v) =>
              updateUserPrefs({ ...userPrefs, appLanguage: v as UserPrefs['appLanguage'] })
            }
          />
          <SegmentedRow
            label="AI explanation language"
            value={userPrefs.aiLanguage}
            options={APP_LANGUAGE_OPTIONS}
            onChange={(v) =>
              updateUserPrefs({ ...userPrefs, aiLanguage: v as UserPrefs['aiLanguage'] })
            }
          />
          <SegmentedRow
            label="Reading speed unit"
            value={userPrefs.speedUnit}
            options={[
              { value: 'wpm', label: 'Words/min' },
              { value: 'pages_per_hour', label: 'Pages/hr' },
            ]}
            onChange={(v) =>
              updateUserPrefs({ ...userPrefs, speedUnit: v as UserPrefs['speedUnit'] })
            }
          />
        </Section>

        <Section title="Personalization">
          <ToggleRow
            label="Remember font and theme per book"
            sub="Each book reopens with the last typography you used for it"
            value={userPrefs.rememberPerBook}
            onChange={(v) => updateUserPrefs({ ...userPrefs, rememberPerBook: v })}
          />
          <View
            className="px-3 py-3 border-t"
            style={{ borderTopColor: colors.borderSubtle }}
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}>
              Reading speed
            </Text>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 14,
                color: colors.textPrimary,
                marginTop: 4,
              }}
            >
              {calibratedWpm
                ? userPrefs.speedUnit === 'pages_per_hour'
                  ? `${Math.round((calibratedWpm * 60) / 250)} pages/hr`
                  : `${calibratedWpm} wpm`
                : 'Still learning your pace…'}
            </Text>
            <Text
              style={{
                fontFamily: Fonts.ui,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 4,
              }}
            >
              Calculated automatically from your reading sessions.
            </Text>
          </View>
        </Section>

        <MetaHeader>Account</MetaHeader>

        <Section title="Email">
          <View className="px-3 py-3 border-t" style={{ borderTopColor: colors.borderSubtle }}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}>
              Email
            </Text>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: colors.textPrimary, marginTop: 4 }}>
              {email ?? ''}
            </Text>
          </View>
        </Section>

        <Section title="Notifications">
          <ToggleRow
            label="All notifications"
            value={notifPrefs.master}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, master: v })}
          />
          <ToggleRow
            label="Daily reading reminder"
            value={notifPrefs.dailyReminder}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, dailyReminder: v })}
          />
          {notifPrefs.dailyReminder ? (
            <TimeRow
              label="Reminder time"
              value={notifPrefs.reminderTime}
              onChange={(t) => updateNotifPrefs({ ...notifPrefs, reminderTime: t })}
            />
          ) : null}
          <ToggleRow
            label="Streak at risk warning"
            value={notifPrefs.streakAtRisk}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, streakAtRisk: v })}
          />
          <ToggleRow
            label="New club discussion"
            value={notifPrefs.newClubDiscussion}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, newClubDiscussion: v })}
          />
          <ToggleRow
            label="Someone replied to your comment"
            value={notifPrefs.someoneRepliedToComment}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, someoneRepliedToComment: v })}
          />
          <ToggleRow
            label="New follower"
            value={notifPrefs.newFollower}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, newFollower: v })}
          />
          <ToggleRow
            label="Badge earned"
            value={notifPrefs.badgeEarned}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, badgeEarned: v })}
          />
          <ToggleRow
            label="Friend finished a book"
            value={notifPrefs.friendFinishedBook}
            onChange={(v) => updateNotifPrefs({ ...notifPrefs, friendFinishedBook: v })}
          />
          <TimeRow
            label="Quiet hours start"
            value={notifPrefs.quietStart}
            onChange={(t) => updateNotifPrefs({ ...notifPrefs, quietStart: t })}
          />
          <TimeRow
            label="Quiet hours end"
            value={notifPrefs.quietEnd}
            onChange={(t) => updateNotifPrefs({ ...notifPrefs, quietEnd: t })}
          />
        </Section>

        <Section title="Privacy">
          <SegmentedRow
            label="Profile visibility"
            value={visibility}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'followers', label: 'Followers' },
              { value: 'private', label: 'Private' },
            ]}
            onChange={(v) => updateVisibility(v as ProfileVisibility)}
          />
          <ToggleRow
            label="Show reading progress to followers"
            value={progressPublic}
            onChange={updateProgressPublic}
          />
          <ToggleRow
            label="Anonymous highlights"
            sub="Public highlights aren't attributed to you"
            value={anonHighlights}
            onChange={updateAnon}
          />
        </Section>

        <Section title="Data">
          <LinkRow
            label={importBusy && importSource === 'Goodreads' ? 'Importing…' : 'Import from Goodreads'}
            onPress={importGoodreads}
          />
          <LinkRow
            label={importBusy && importSource === 'StoryGraph' ? 'Importing…' : 'Import from StoryGraph'}
            onPress={importStoryGraph}
          />
          <LinkRow
            label={busy ? 'Preparing export…' : 'Export my data'}
            onPress={exportData}
          />
        </Section>

        <Section title="Close friends">
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              color: colors.textTertiary,
              marginBottom: 8,
              lineHeight: 18,
            }}
          >
            Close friends can see your private passage comments and reactions
            marked as close friends only.
          </Text>
          <LinkRow
            label="Manage close friends"
            onPress={() => router.push('/close-friends' as never)}
          />
        </Section>

        <Section title="About">
          <View className="px-3 py-3 border-t" style={{ borderTopColor: colors.borderSubtle }}>
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.textTertiary }}>
              Version
            </Text>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: colors.textPrimary, marginTop: 4 }}>
              {APP_VERSION}
            </Text>
          </View>
          <LinkRow
            label="Privacy policy"
            onPress={() => Share.share({ message: `${SITE_ORIGIN}/privacy` })}
          />
          <LinkRow
            label="Terms of service"
            onPress={() => Share.share({ message: `${SITE_ORIGIN}/terms` })}
          />
          <LinkRow
            label="Send feedback"
            onPress={() => Share.share({ message: 'mailto:feedback@foxing.app' })}
          />
          <LinkRow
            label="Rate Foxing"
            onPress={() => Share.share({ message: `${SITE_ORIGIN}/rate` })}
          />
        </Section>

        {/* Delete account, separated from About so it isn't a "link" in
            a long list of innocuous ones. */}
        <View style={{ marginTop: 24 }}>
          <Pressable
            onPress={deleteAccount}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            className="flex-row items-center justify-center gap-2 px-3 py-3 rounded-xl border"
            style={{ borderColor: colors.errorBorderInteractive }}
          >
            <Trash color={colors.error} size={14} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.error }}>
              Delete account
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Result modal, shows after the importer finishes. */}
      <Modal
        visible={importResult !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setImportResult(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: colors.overlay }}
          onPress={() => setImportResult(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full p-4 rounded-2xl bg-bg-elevated-light dark:bg-bg-elevated-dark"
          >
            <Text
              style={{
                fontFamily: Fonts.displayBold,
                fontSize: 18,
                color: colors.textPrimary,
                marginBottom: 6,
              }}
            >
              {importSource} import complete
            </Text>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 14,
              }}
            >
              {importResult?.imported ?? 0} books imported. {importResult?.skipped ?? 0} not found in catalog.
            </Text>
            <View className="flex-row justify-end">
              <Pressable
                onPress={() => setImportResult(null)}
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: colors.brandUi }}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

// ── Reusable rows ────────────────────────────────────────────────────────

// ── Goodreads CSV parsing ────────────────────────────────────────────────

