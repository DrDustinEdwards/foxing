import { createDb, views } from "@foxing/core";
import { useState } from "react";
import { YearView } from "~/components/reading/year-view";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/year";
import { noindexPageMeta } from "~/lib/seo";

export function meta() {
  return noindexPageMeta("Your year in reading | Foxing");
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

  const years = new Set<number>([year]);
  for (let y = thisYear; y >= thisYear - 6; y--) years.add(y);
  return {
    ...data,
    year,
    years: [...years].sort((a, b) => b - a),
  };
}

export default function Year({ loaderData }: Route.ComponentProps) {
  const [thisYear] = useState(() => new Date().getUTCFullYear());
  return <YearView data={loaderData} yearHref={(y) => (y === thisYear ? "/year" : `/year/${y}`)} />;
}

export const handle = { hydrate: true };
