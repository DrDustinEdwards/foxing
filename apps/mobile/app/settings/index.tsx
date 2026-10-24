import { NOTIFICATION_LABELS, useMe, useSetNotificationPrefs, useSetVisibility } from '@foxing/client'
import type * as W from '@foxing/types'
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, Share, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { CaretLeft, Trash } from 'phosphor-react-native'
import { api } from '@/lib/api'
import { importCsv, type ImportResult, type ImportSource } from '@/lib/import'
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
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { LinkRow, MetaHeader, Section, SegmentedRow, TimeRow, ToggleRow } from '@/components/settings/settings-rows'
import { ChangeEmailSheet, DeleteAccountSheet, LinkedAccounts } from '@/components/settings/account-sheets'

const APP_VERSION = '1.0.0'
// Device-only settings. The account's own (visibility, push switches, quiet hours) live
// on the server through /me, the same ones the web settings page edits.
const LOCAL_REMINDERS_KEY = 'notification_prefs'
const READING_DEFAULTS_KEY = 'reading_defaults'
const A11Y_HIGH_CONTRAST_KEY = 'a11y_high_contrast'
const A11Y_REDUCE_MOTION_KEY = 'a11y_reduce_motion'
const TTS_SPEED_KEY = 'tts_speed'

/** What lib/local-notifications schedules on the device. streakAtRisk follows the
 *  account's "streak" push switch, so one toggle governs streak nudges everywhere. */
interface LocalReminders {
  master: boolean
  dailyReminder: boolean
  reminderTime: string
  streakAtRisk: boolean
}

const DEFAULT_LOCAL_REMINDERS: LocalReminders = {
  master: true,
  dailyReminder: false,
  reminderTime: '20:00',
  streakAtRisk: true,
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

type Sheet = 'email' | 'delete' | null

export default function SettingsScreen() {
  const colors = useColors()
  const router = useRouter()
  const me = useMe().data
  const profile = me?.profile ?? null
  const setVisibility = useSetVisibility()
  const setPrefs = useSetNotificationPrefs()

  const [hapticsOn, setHapticsOn] = useState(true)
  const [readingDefaults, setReadingDefaults] = useState<ReadingDefaults>(DEFAULT_READING_DEFAULTS)
  const [reminders, setReminders] = useState<LocalReminders>(DEFAULT_LOCAL_REMINDERS)
  const [userPrefs, setUserPrefsState] = useState<UserPrefs>(DEFAULT_USER_PREFS)
  const [calibratedWpm, setCalibratedWpmState] = useState<number | null>(null)
  const [highContrast, setHighContrast] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [importing, setImporting] = useState<{ source: ImportSource; done: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<(ImportResult & { source: ImportSource }) | null>(null)
  const [exporting, setExporting] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // ── Load device settings ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [local, defaults, hc, rm, tts] = await Promise.all([
        AsyncStorage.getItem(LOCAL_REMINDERS_KEY),
        AsyncStorage.getItem(READING_DEFAULTS_KEY),
        AsyncStorage.getItem(A11Y_HIGH_CONTRAST_KEY),
        AsyncStorage.getItem(A11Y_REDUCE_MOTION_KEY),
        AsyncStorage.getItem(TTS_SPEED_KEY),
      ])
      if (!mounted) return
      if (local) {
        try {
          setReminders({ ...DEFAULT_LOCAL_REMINDERS, ...JSON.parse(local) })
        } catch { /* ignore */ }
      }
      if (defaults) {
        try {
          setReadingDefaults({ ...DEFAULT_READING_DEFAULTS, ...JSON.parse(defaults) })
        } catch { /* ignore */ }
      }
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

  const updateReminders = useCallback(async (next: LocalReminders) => {
    setReminders(next)
    await AsyncStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(next))
    // Re-program the device's scheduled reminders to match.
    rescheduleAll().catch(() => {})
  }, [])

  const updateUserPrefs = useCallback(async (next: UserPrefs) => {
    setUserPrefsState(next)
    await setUserPrefs(next)
  }, [])

  // ── Account settings (saved on toggle; the cached profile patches at once) ─
  const visibility = profile?.visibility ?? {}
  const saveVisibility = (patch: Partial<Required<W.MyProfile['visibility']>>) =>
    setVisibility.fire({
      profile: visibility.profile ?? 'public',
      progress: visibility.progress ?? 'public',
      defaultAnnotation: visibility.defaultAnnotation ?? 'private',
      ...patch,
    })

  const categories = profile?.notificationPrefs.categories ?? {}
  const quietHours = profile?.notificationPrefs.quietHours ?? null
  const savePrefs = (next: { categories?: Record<string, boolean>; quietHours?: { start: string; end: string } | null }) =>
    setPrefs.fire({
      categories: next.categories ?? categories,
      quietHours: next.quietHours !== undefined ? next.quietHours : quietHours,
    })
  const toggleCategory = (cat: string, on: boolean) => {
    savePrefs({ categories: { ...categories, [cat]: on } })
    if (cat === 'streak') void updateReminders({ ...reminders, streakAtRisk: on })
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const runImport = async (source: ImportSource) => {
    if (importing) return
    setDataError(null)
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      })
      const uri = pick.canceled ? null : pick.assets?.[0]?.uri
      if (!uri) return
      const text = await new File(uri).text()
      setImporting({ source, done: 0, total: 0 })
      const result = await importCsv(text, source, (done, total) => setImporting({ source, done, total }))
      setImportResult({ ...result, source })
    } catch {
      setDataError(`Could not read that ${source} export.`)
    } finally {
      setImporting(null)
    }
  }

  // GET /account/export: the same JSON archive the web page downloads, handed to the share sheet.
  const exportData = async () => {
    if (exporting) return
    setExporting(true)
    setDataError(null)
    try {
      const archive = await api.get<unknown>('/account/export')
      const file = new File(Paths.cache, 'foxing-export.json')
      file.write(JSON.stringify(archive, null, 2))
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Your Foxing data' })
    } catch {
      setDataError('Could not prepare your data export. Check your connection and try again.')
    } finally {
      setExporting(false)
    }
  }

  const accountError = setVisibility.error ?? setPrefs.error

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <View className="flex-row items-center px-3 py-2">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-2" accessibilityRole="button" accessibilityLabel="Back">
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

        {accountError ? (
          <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error, marginTop: 12 }} accessibilityRole="alert">
            {accountError}
          </Text>
        ) : null}

        <Section title="Sign-in">
          <LinkRow label={me ? `Email: ${me.user.email}` : 'Email'} onPress={() => setSheet('email')} />
          <LinkedAccounts Row={(row) => <LinkRow {...row} />} />
        </Section>

        <Section title="Notifications">
          <ToggleRow
            label="Daily reading reminder"
            sub="Scheduled on this device"
            value={reminders.dailyReminder}
            onChange={(v) => updateReminders({ ...reminders, dailyReminder: v })}
          />
          {reminders.dailyReminder ? (
            <TimeRow
              label="Reminder time"
              value={reminders.reminderTime}
              onChange={(t) => updateReminders({ ...reminders, reminderTime: t })}
            />
          ) : null}
          {Object.entries(NOTIFICATION_LABELS).map(([cat, { label, subtext }]) => (
            <ToggleRow
              key={cat}
              label={label}
              sub={subtext}
              value={categories[cat] ?? false}
              onChange={(on) => toggleCategory(cat, on)}
            />
          ))}
          <ToggleRow
            label="Quiet hours"
            sub="Pause notifications between these times, in your timezone"
            value={quietHours !== null}
            onChange={(on) => savePrefs({ quietHours: on ? { start: '22:00', end: '07:00' } : null })}
          />
          {quietHours ? (
            <>
              <TimeRow label="From" value={quietHours.start} onChange={(start) => savePrefs({ quietHours: { ...quietHours, start } })} />
              <TimeRow label="To" value={quietHours.end} onChange={(end) => savePrefs({ quietHours: { ...quietHours, end } })} />
            </>
          ) : null}
        </Section>

        <Section title="Privacy">
          <ToggleRow
            label="Public profile"
            sub="Let other readers find your profile, library and reviews"
            value={visibility.profile !== 'private'}
            onChange={(on) => saveVisibility({ profile: on ? 'public' : 'private' })}
          />
          <ToggleRow
            label="Share reading progress"
            sub="Show what you are currently reading on your profile"
            value={visibility.progress !== 'private'}
            onChange={(on) => saveVisibility({ progress: on ? 'public' : 'private' })}
          />
          <SegmentedRow
            label="New highlights and notes are seen by"
            value={visibility.defaultAnnotation ?? 'private'}
            options={[
              { value: 'private', label: 'Only me' },
              { value: 'friends', label: 'Close friends' },
              { value: 'public', label: 'Everyone' },
            ]}
            onChange={(v) => saveVisibility({ defaultAnnotation: v })}
          />
        </Section>

        <Section title="Data">
          {(['Goodreads', 'StoryGraph'] as const).map((source) => (
            <LinkRow
              key={source}
              label={
                importing?.source === source
                  ? `Importing… ${importing.done} of ${importing.total || '?'}`
                  : `Import from ${source}`
              }
              onPress={() => runImport(source)}
            />
          ))}
          <LinkRow label={exporting ? 'Preparing export…' : 'Export my data'} onPress={exportData} />
          {dataError ? (
            <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error, padding: 12 }} accessibilityRole="alert">
              {dataError}
            </Text>
          ) : null}
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
            Close friends see your friends-only highlights, notes and activity.
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
            onPress={() => Share.share({ message: 'https://foxing.app/privacy' })}
          />
          <LinkRow
            label="Terms of service"
            onPress={() => Share.share({ message: 'https://foxing.app/terms' })}
          />
          <LinkRow
            label="Send feedback"
            onPress={() => Share.share({ message: 'mailto:feedback@foxing.app' })}
          />
          <LinkRow
            label="Rate Foxing"
            onPress={() => Share.share({ message: 'https://foxing.app/rate' })}
          />
        </Section>

        <View style={{ marginTop: 24 }}>
          <Pressable
            onPress={() => setSheet('delete')}
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

      <ChangeEmailSheet visible={sheet === 'email'} email={me?.user.email ?? ''} onClose={() => setSheet(null)} />
      <DeleteAccountSheet visible={sheet === 'delete'} onClose={() => setSheet(null)} />

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
              {importResult?.source} import complete
            </Text>
            <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 14,
              }}
            >
              {importResult?.imported ?? 0} books added to your library. {importResult?.skipped ?? 0} not found in the catalog.
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
