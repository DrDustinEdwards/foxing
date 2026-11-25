import {
  RefusedError,
  type DueSchedule,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { type d1ScheduledUpdates, utc } from "@dustinedwards/site-api/schedules";
import { adminRepo, type Db } from "@foxing/core";
import { readSource, type JournalPost } from "./journal-rows.server";
import type { JournalFields } from "./journal-source";

type Written = (postId: string, changeId: string) => Promise<WriteResult>;

export function journalScheduleAdapter(ctx: {
  db: Db;
  schedules: ReturnType<typeof d1ScheduledUpdates>;
  expected: (slug: string, version: string) => Promise<JournalPost>;
  held: (slug: string, version: string) => Promise<JournalPost>;
  rowValues: (slug: string, fields: JournalFields, current: string | null) => Promise<unknown>;
  save: (row: JournalPost, source: string, changeId: string) => Promise<Date>;
  putSchedule: (
    row: JournalPost,
    input: { source: string; publishAt: string; changeId: string },
  ) => Promise<WriteResult>;
  audit: (action: string, params: Record<string, unknown>) => Promise<void>;
  written: Written;
}): NonNullable<SiteAdapter["schedules"]> {
  const { db, schedules, expected, held, rowValues, save, putSchedule, audit, written } = ctx;
  return {
    async get(id) {
      const row = await adminRepo.getJournalBySlug(db, id);
      if (!row?.isPublished) return null;
      return schedules.get(id);
    },

    async update(id, input) {
      const row = await expected(id, input.expectedVersion);
      if (!row.isPublished) throw new RefusedError("Only a live post takes a scheduled update.");
      await rowValues(id, readSource(input.source), row.authorId);
      return putSchedule(row, input);
    },

    async cancel(id, input) {
      const row = await held(id, input.expectedVersion);
      if (!(await schedules.get(id))) throw new RefusedError("Nothing is scheduled for this post.");
      await schedules.remove(id).run();
      await audit("journal.unschedule", { id: row.id, slug: id, changeId: input.changeId });
      return written(row.id, input.changeId);
    },

    async due({ now, limit }) {
      const due = await schedules.due(now, limit);
      return Promise.all(
        due.map(async (d): Promise<DueSchedule> => {
          const row = await adminRepo.getJournalBySlug(db, d.id);
          return { ...d, kind: row?.isPublished ? "update" : "publish" };
        }),
      );
    },

    // The post's write comes first, the row second (matched on its time and change id, so a reschedule in between
    // survives); if the drop fails the next pass finds the post already as the row describes.
    async apply(id, input) {
      const row = await adminRepo.getJournalBySlug(db, id);
      const waiting = await schedules.get(id);
      if (!row || !waiting || row.trashedAt) return null;
      if (waiting.changeId !== input.changeId || waiting.publishAt !== utc(input.publishAt))
        return null;
      if (Date.parse(waiting.publishAt) > input.now.getTime()) return null;
      if (input.kind === "update") {
        if (!row.isPublished) return null;
        await save(row, waiting.source, input.changeId);
      } else {
        if (row.isPublished) return null;
        const done = await adminRepo.setJournalPublished(
          db,
          row.id,
          true,
          { expectedUpdatedAt: row.updatedAt },
          row.publishedAt ? {} : { publishedAt: new Date(waiting.publishAt) },
        );
        if (!done) return null;
        await audit("journal.publish", {
          id: row.id,
          slug: id,
          changeId: input.changeId,
          firstPublish: !row.publishedAt,
          scheduled: waiting.publishAt,
        });
      }
      await schedules
        .remove(id, { publishAt: waiting.publishAt, changeId: waiting.changeId })
        .run();
      return written(row.id, input.changeId);
    },
  };
}
