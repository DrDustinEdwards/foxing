import { createDb, libraryRepo, views } from "@foxing/core";
import { StatsView } from "~/components/reading/stats-view";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/stats";
import { noindexMeta } from "~/lib/seo";

export function meta() {
  return noindexMeta("Reading stats | Foxing");
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const db = createDb(env.DB);
  const [stats, goals] = await Promise.all([
    views.stats(db, user.id),
    libraryRepo.listGoals(db, user.id),
  ]);
  return {
    ...stats,
    goals: goals.map((g) => ({
      id: g.id,
      type: g.type,
      target: g.target,
      periodType: g.periodType,
    })),
  };
}

export default function Stats({ loaderData }: Route.ComponentProps) {
  return <StatsView data={loaderData} />;
}

export const handle = { hydrate: true };
