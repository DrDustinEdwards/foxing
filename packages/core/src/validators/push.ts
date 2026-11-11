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
// profile timezone, each a 24-hour HH:MM (00:00 to 23:59; zod's ISO time without seconds, so 99:99 is refused).
// Used by the push delivery gate (domain/push.ts).
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

// POST /notifications/read: { ids } marks those (one page fits one D1 IN list); a body naming no ids, `{}` or
// { all: true }, marks every one. `{}` is mark-all as the API has always read it and as mobile builds before
// { all: true } still send it. A body that is not one of these (wrong types, empty ids, all: false, unknown keys,
// not JSON) is a 422 that changes nothing (RFC 9110 section 15.5.21); it used to fall through to mark-all.
export const markNotificationsReadInput = z.union([
  z.strictObject({ ids: z.array(z.string().min(1).max(64)).min(1).max(90) }),
  z.strictObject({ all: z.literal(true).optional() }),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInput>;
