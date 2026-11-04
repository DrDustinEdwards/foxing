// The signed-in reader's reading stats (auth-gated, noindex). Reads run in-process via
// core; requireProfile gates access. The page is StatsView (components/reading/stats-view.tsx),
// which /demos/stats draws with sample numbers. Read-only.
import { createDb, libraryRepo, views } from "@foxing/core";
import { StatsView } from "~/components/reading/stats-view";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/stats";

export function meta() {
  return [{ title: "Reading stats | Foxing" }, { name: "robots", content: "noindex" }];
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

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
