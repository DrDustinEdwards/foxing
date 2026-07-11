// Push registration contract (Phase 7). The mobile client registers its Expo push token
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
  categories: z.record(z.boolean()).optional(),
  quietHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .nullable()
    .optional(),
});
export type NotificationPrefsInput = z.infer<typeof notificationPrefsInput>;
