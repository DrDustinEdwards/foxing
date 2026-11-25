import { DemoNotice } from "~/components/demo-notice";
import { StatsView } from "~/components/reading/stats-view";
import { sampleStats } from "~/lib/demo/reading-sample";
import type { Route } from "./+types/stats";
import { noindexMeta } from "~/lib/seo";

export function meta() {
  return noindexMeta("Reading stats demo | Foxing");
}

export function loader() {
  return sampleStats();
}

export default function StatsDemo({ loaderData }: Route.ComponentProps) {
  return <StatsView data={loaderData} notice={<DemoNotice />} />;
}

export const handle = { hydrate: true };
