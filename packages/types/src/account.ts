import type { BookCard, Visibility } from "./common";
import type { GenreFacet } from "./catalog";

export interface MyProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  backdropUrl: string | null;
  bio: string | null;
  favoriteGenres: string[];
  subscriptionTier: "free" | "plus";
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: number | null;
  timezone: string | null;
  visibility: {
    profile?: "public" | "private";
    progress?: "public" | "private";
    defaultAnnotation?: Visibility;
  };
  notificationPrefs: {
    categories?: Record<string, boolean>;
    quietHours?: { start: string; end: string };
  };
  createdAt: number;
}

export interface OnboardingPage {
  starters: BookCard[];
  genres: GenreFacet[];
}

export interface ClubHandover {
  clubId: string;
  name: string;
  candidates: { userId: string; name: string; role: string }[];
  suggested: string | null;
}

export interface Me {
  user: { id: string; email: string };
  /** Null until onboarding has created the profile. */
  profile: MyProfile | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: number;
}

export interface NotificationsPage {
  notifications: NotificationItem[];
  unread: number;
  /** `<ms>.<id>` of the last row, for `?cursor=`, or null on the last page. */
  nextCursor: string | null;
}
