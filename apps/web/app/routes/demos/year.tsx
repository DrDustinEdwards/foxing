// /demos/year: the signed-in Year in Reading (routes/year.tsx) drawn with a sample year, so its charts can
// be seen and checked live without a sign-in (devkit live/areas.json, area 10). No loader reads D1.
import { DemoNotice } from "~/components/demo-notice";
import { YearView } from "~/components/reading/year-view";
import { sampleYear } from "~/lib/demo/reading-sample";
import type { Route } from "./+types/year";

export function meta() {
  return [{ title: "Year in reading demo | Foxing" }, { name: "robots", content: "noindex" }];
}

export function loader() {
  return sampleYear();
}

export default function YearDemo({ loaderData }: Route.ComponentProps) {
  return (
    <YearView
      data={loaderData}
      notice={<DemoNotice />}
      yearHref={() => "/demos/year"}
      share={false}
    />
  );
}

// It hydrates, as /year does (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
