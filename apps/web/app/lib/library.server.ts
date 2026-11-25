import { createDb, views } from "@foxing/core";

export async function loadLibraryData(env: Env, userId: string) {
  const db = createDb(env.DB);
  const [library, shelves, goals, streak] = await Promise.all([
    views.library(db, userId),
    views.shelves(db, userId),
    views.goals(db, userId),
    views.streak(db, userId),
  ]);
  return { library, shelves, goals, streak };
}
