import { DemoNotice } from "~/components/demo-notice";
import { YearView } from "~/components/reading/year-view";
import { sampleYear } from "~/lib/demo/reading-sample";
import type { Route } from "./+types/year";
import { noindexMeta } from "~/lib/seo";

export function meta() {
  return noindexMeta("Year in reading demo | Foxing");
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

export const handle = { hydrate: true };
