import { z } from "zod";
import { pushPlatform } from "../enums";

export const pushRegisterInput = z.object({
  token: z.string().min(1).max(256),
  platform: pushPlatform, // ios | android
});
export type PushRegisterInput = z.infer<typeof pushRegisterInput>;

// notification_prefs (json on profiles): per-category booleans + quiet hours in the profile timezone, each a 24-hour HH:MM (zod's ISO time without seconds, so 99:99 is refused).
export const notificationPrefsInput = z.object({
  categories: z.record(z.string(), z.boolean()).optional(),
  quietHours: z
    .object({
      start: z.iso.time({ precision: -1 }),
      end: z.iso.time({ precision: -1 }),
    })
    .nullable()
    .optional(),
});
export type NotificationPrefsInput = z.infer<typeof notificationPrefsInput>;

// POST /notifications/read: { ids } marks those (one page fits one D1 IN list); `{}` or { all: true } marks every one (mobile builds before { all: true } still send `{}`).
// Any other body is a 422 that changes nothing.
export const markNotificationsReadInput = z.union([
  z.strictObject({ ids: z.array(z.string().min(1).max(64)).min(1).max(90) }),
  z.strictObject({ all: z.literal(true).optional() }),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInput>;
