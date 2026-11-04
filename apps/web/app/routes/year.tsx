// The signed-in reader's OWN Year in Reading (auth-gated, noindex). Reuses the exact
// recap aggregation that powers the public /u/:username/recap/:year, targeted by user id
// so it is always the viewer's own. /year shows the current year; /year/:year picks one.
// A year picker links between years. The shareable public version lives on the profile.
// The page is YearView (components/reading/year-view.tsx), which /demos/year draws with a sample year.
import { createDb, views } from "@foxing/core";
import { YearView } from "~/components/reading/year-view";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/year";

export function meta() {
  return [{ title: "Your year in reading | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = params.year ? Number(params.year) : thisYear;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Response("Not found", { status: 404 });
  }
  const data = await views.recap(createDb(env.DB), { userId: user.id }, year, user.id);
  if (!data) throw new Response("Not found", { status: 404 });

  // Year picker spans this year back six, always including the selected one.
  const years = new Set<number>([year]);
  for (let y = thisYear; y >= thisYear - 6; y--) years.add(y);
  return {
    ...data,
    year,
    years: [...years].sort((a, b) => b - a),
  };
}

export default function Year({ loaderData }: Route.ComponentProps) {
  const thisYear = new Date().getUTCFullYear();
  return <YearView data={loaderData} yearHref={(y) => (y === thisYear ? "/year" : `/year/${y}`)} />;
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
