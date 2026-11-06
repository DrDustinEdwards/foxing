// Push registration contract. The mobile client registers its Expo push token
// after sign-in; the token is pruned server-side when Expo reports DeviceNotRegistered.
import { z } from "zod";
import { pushPlatform } from "../enums";

export const pushRegisterInput = z.object({
  token: z.string().min(1).max(256),
  platform: pushPlatform, // ios | android
});
export type PushRegisterInput = z.infer<typeof pushRegisterInput>;

// notification_prefs (json on profiles): per-category booleans + quiet hours in the
// profile timezone. Used by the push delivery gate (domain/push.ts).
export const notificationPrefsInput = z.object({
  categories: z.record(z.string(), z.boolean()).optional(),
  quietHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .nullable()
    .optional(),
});
export type NotificationPrefsInput = z.infer<typeof notificationPrefsInput>;

// POST /notifications/read: the given notifications, or every one only when asked for by name. Anything else is a 422
// that changes nothing (a malformed body used to mark all of them read). One page of ids fits one D1 IN list.
export const markNotificationsReadInput = z.union([
  z.strictObject({ ids: z.array(z.string().min(1).max(64)).min(1).max(90) }),
  z.strictObject({ all: z.literal(true) }),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInput>;
