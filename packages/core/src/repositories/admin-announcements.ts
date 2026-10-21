import { chunked, type Db, rowsPerInsert } from "../db";
import { announcements, notifications, profiles } from "../schema";
import { and, desc, eq, getTableColumns } from "drizzle-orm";

/** Insert one notification per onboarded user. Returns how many were written. Chunked
 *  so a large audience never exceeds D1's bound-parameter limit (db.ts). */
// ---- Broadcast notifications --------------------------------------------------

export async function broadcastNotification(
  db: Db,
  input: { type: string; title: string; body?: string | null },
): Promise<number> {
  const recipients = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.isSuspended, false));
  const now = new Date();
  const rows = recipients.map((r) => ({
    userId: r.id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    createdAt: now,
  }));
  // Eight columns a row, each a bound parameter: twelve rows an INSERT.
  for (const chunk of chunked(
    rows,
    rowsPerInsert(Object.keys(getTableColumns(notifications)).length),
  )) {
    await db.insert(notifications).values(chunk);
  }
  return rows.length;
}

// ---- Announcements ------------------------------------------------------------

export type Announcement = typeof announcements.$inferSelect;

export async function listAnnouncements(db: Db): Promise<Announcement[]> {
  return db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
}

/** The single live announcement for a placement, if any (is_active + within window).
 *  The window bounds (null = open-ended) are checked in JS to keep the null semantics
 *  readable; the active-set for one placement is tiny. */
export async function getActiveAnnouncement(
  db: Db,
  placement = "banner",
): Promise<Announcement | null> {
  const now = new Date();
  const rows = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.isActive, true), eq(announcements.placement, placement)))
    .orderBy(desc(announcements.createdAt))
    .limit(10);
  const live = rows.find(
    (a) => (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt >= now),
  );
  return live ?? null;
}

export async function getAnnouncement(db: Db, id: string): Promise<Announcement | null> {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  return row ?? null;
}

export type AnnouncementInput = {
  title: string;
  body: string;
  placement?: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export async function createAnnouncement(
  db: Db,
  input: AnnouncementInput,
  createdBy: string,
): Promise<string> {
  const [row] = await db
    .insert(announcements)
    .values({
      title: input.title,
      body: input.body,
      placement: input.placement ?? "banner",
      linkUrl: input.linkUrl ?? null,
      linkLabel: input.linkLabel ?? null,
      isActive: input.isActive ?? false,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdBy,
    })
    .returning({ id: announcements.id });
  return row.id;
}

export async function updateAnnouncement(
  db: Db,
  id: string,
  input: Partial<AnnouncementInput>,
): Promise<void> {
  await db
    .update(announcements)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(announcements.id, id));
}

export async function deleteAnnouncement(db: Db, id: string): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id));
}
