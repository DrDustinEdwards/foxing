// Library domain logic. changeBookStatus is the single write path for shelf
// status: it upserts user_books AND emits the activity/notification events on the
// core write path (never from clients), so web and mobile feeds stay in parity.
// Per the spec-cf-api event catalog: reading -> started_book, finished ->
// finished_book (+ books_finished streak total, + goal_met when a books goal is
// reached). Badge awarding on finish is deferred (see deferred-items.md).
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import type { UserBookStatus } from "../enums";
import { emit, type EventActor } from "../events";
import * as libraryRepo from "../repositories/library";
import { books } from "../schema";

async function bookTitle(db: Db, bookId: string): Promise<string> {
  const rows = await db
    .select({ title: books.title })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  return rows[0]?.title ?? "";
}

export async function changeBookStatus(
  db: Db,
  actor: EventActor,
  bookId: string,
  status: UserBookStatus,
): Promise<libraryRepo.UserBook> {
  const { row, wasFinished } = await libraryRepo.upsertStatus(db, actor.userId, bookId, status);

  if (status === "reading") {
    const title = await bookTitle(db, bookId);
    await emit(db, "library.status.reading", actor, { bookId, title });
  } else if (status === "finished" && !wasFinished) {
    const title = await bookTitle(db, bookId);
    await emit(db, "library.status.finished", actor, { bookId, title });
    await libraryRepo.incrementBooksFinished(db, actor.userId);

    // goal_met: a books-type goal whose finished count now equals its target.
    const goals = await libraryRepo.listGoals(db, actor.userId);
    for (const g of goals) {
      if (g.type !== "books") continue;
      const progress = await libraryRepo.countFinishedInPeriod(db, actor.userId, g);
      if (progress === g.target) {
        await emit(db, "goal.met", actor, { goalId: g.id, goalType: g.type, target: g.target });
      }
    }
  }

  return row;
}
