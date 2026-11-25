import AsyncStorage from "@react-native-async-storage/async-storage";

type NotificationsModule = {
  setNotificationHandler: (handler: { handleNotification: () => Promise<unknown> }) => void;
  requestPermissionsAsync: () => Promise<{ status: string; granted?: boolean }>;
  getPermissionsAsync: () => Promise<{ status: string; granted?: boolean }>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
  scheduleNotificationAsync: (req: {
    identifier?: string;
    content: { title: string; body?: string; data?: Record<string, unknown> };
    trigger: unknown;
  }) => Promise<string>;
  // Older expo-notifications versions accept the raw { hour, minute, repeats } shape.
  SchedulableTriggerInputTypes?: Record<string, string>;
};

let Notifications: NotificationsModule | null = null;
try {
  Notifications = require("expo-notifications") as NotificationsModule;
  // Show alerts in the foreground; they are timely (8pm streak risk).
  Notifications?.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  Notifications = null;
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted" || existing.granted === true) return true;
    const next = await Notifications.requestPermissionsAsync();
    return next.status === "granted" || next.granted === true;
  } catch {
    return false;
  }
}

const REMINDER_ID = "foxing-daily-reading-reminder";
const STREAK_RISK_ID = "foxing-streak-risk-8pm";

interface NotificationPrefs {
  master: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  streakAtRisk: boolean;
}

async function readPrefs(): Promise<NotificationPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem("notification_prefs");
    if (!raw) return null;
    return JSON.parse(raw) as NotificationPrefs;
  } catch {
    return null;
  }
}

function parseHhMm(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}

export async function rescheduleAll(): Promise<void> {
  if (!Notifications) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  const prefs = await readPrefs();
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_RISK_ID);
  } catch {}
  if (!prefs || prefs.master === false) return;

  if (prefs.dailyReminder) {
    const t = parseHhMm(prefs.reminderTime ?? "20:00") ?? { hour: 20, minute: 0 };
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: "Time to read",
          body: "Open a book, even five minutes counts.",
        },
        trigger: { hour: t.hour, minute: t.minute, repeats: true },
      });
    } catch (e) {
      console.warn("[local-notif] reminder schedule failed:", e instanceof Error ? e.message : e);
    }
  }

  if (prefs.streakAtRisk !== false) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: STREAK_RISK_ID,
        content: {
          title: "Keep your streak going",
          body: "A few pages today keeps it going.",
        },
        trigger: { hour: 20, minute: 0, repeats: true },
      });
    } catch (e) {
      console.warn(
        "[local-notif] streak risk schedule failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }
}
