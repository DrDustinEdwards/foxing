// Library page data, loaded in-process via core's views (the standing rule: loaders
// never self-fetch the Worker's own /api/v1). The same views answer the GET routes,
// so the page's first paint and the client cache hold one shape (@foxing/types).
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
