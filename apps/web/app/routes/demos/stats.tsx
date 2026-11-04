// /demos/stats: the signed-in stats page (routes/stats.tsx) drawn with sample numbers, so its charts can
// be seen and checked live without a sign-in (devkit live/areas.json, area 10). No loader reads D1.
import { DemoNotice } from "~/components/demo-notice";
import { StatsView } from "~/components/reading/stats-view";
import { sampleStats } from "~/lib/demo/reading-sample";
import type { Route } from "./+types/stats";

export function meta() {
  return [{ title: "Reading stats demo | Foxing" }, { name: "robots", content: "noindex" }];
}

export function loader() {
  return sampleStats();
}

export default function StatsDemo({ loaderData }: Route.ComponentProps) {
  return <StatsView data={loaderData} notice={<DemoNotice />} />;
}

// It hydrates, as /stats does (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
