// Local (device-scheduled) notifications via expo-notifications.
//
// expo-notifications is a native module, only available in the 1.0.1+
// runtime build. We import it conditionally so the bundle still resolves
// on 1.0.0 devices and gracefully no-ops every call. After the build is
// installed, the imports succeed and scheduling lights up.

import AsyncStorage from '@react-native-async-storage/async-storage'

type NotificationsModule = {
  setNotificationHandler: (handler: { handleNotification: () => Promise<unknown> }) => void
  requestPermissionsAsync: () => Promise<{ status: string; granted?: boolean }>
  getPermissionsAsync: () => Promise<{ status: string; granted?: boolean }>
  cancelAllScheduledNotificationsAsync: () => Promise<void>
  cancelScheduledNotificationAsync: (id: string) => Promise<void>
  scheduleNotificationAsync: (req: {
    identifier?: string
    content: { title: string; body?: string; data?: Record<string, unknown> }
    trigger: unknown
  }) => Promise<string>
  // SchedulableTriggerInputTypes lives on the module export in newer
  // versions; older versions accept the raw `{ hour, minute, repeats }`
  // shape that we send here.
  SchedulableTriggerInputTypes?: Record<string, string>
}

let Notifications: NotificationsModule | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications') as NotificationsModule
  // Set the default in-foreground behavior, show alerts even when the app
  // is open, since most of these are timely (streak risk at 8pm).
  Notifications?.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
      // SDK 50+ added these:
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
} catch {
  Notifications = null
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false
  try {
    const existing = await Notifications.getPermissionsAsync()
    if (existing.status === 'granted' || existing.granted === true) return true
    const next = await Notifications.requestPermissionsAsync()
    return next.status === 'granted' || next.granted === true
  } catch {
    return false
  }
}

// Two identifiers we manage. Cancel by these before rescheduling so we
// don't pile up duplicates after a settings change.
const REMINDER_ID = 'foxing-daily-reading-reminder'
const STREAK_RISK_ID = 'foxing-streak-risk-8pm'

interface NotificationPrefs {
  master: boolean
  dailyReminder: boolean
  reminderTime: string
  streakAtRisk: boolean
}

async function readPrefs(): Promise<NotificationPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem('notification_prefs')
    if (!raw) return null
    return JSON.parse(raw) as NotificationPrefs
  } catch {
    return null
  }
}

function parseHhMm(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  return { hour, minute }
}

export async function rescheduleAll(): Promise<void> {
  if (!Notifications) return
  const granted = await ensureNotificationPermission()
  if (!granted) return
  const prefs = await readPrefs()
  // Always clear our two managed identifiers first so toggling a pref off
  // actually removes the schedule.
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID)
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_RISK_ID)
  } catch {}
  if (!prefs || prefs.master === false) return

  if (prefs.dailyReminder) {
    const t = parseHhMm(prefs.reminderTime ?? '20:00') ?? { hour: 20, minute: 0 }
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: 'Time to read',
          body: 'Open a book, even five minutes counts.',
        },
        // Daily trigger, works across SDK 49/50/51 versions. Newer SDKs
        // accept `type: 'daily'`; older SDKs accept the bare shape.
        trigger: { hour: t.hour, minute: t.minute, repeats: true },
      })
    } catch (e) {
      console.warn('[local-notif] reminder schedule failed:', e instanceof Error ? e.message : e)
    }
  }

  if (prefs.streakAtRisk !== false) {
    // Always 8pm local, gives the user a few hours to act before midnight.
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: STREAK_RISK_ID,
        content: {
          title: "Don't break your streak",
          body: 'A few pages keeps it going.',
        },
        trigger: { hour: 20, minute: 0, repeats: true },
      })
    } catch (e) {
      console.warn('[local-notif] streak risk schedule failed:', e instanceof Error ? e.message : e)
    }
  }
}
