// /demos/goals: the goals page's reading activity (routes/goals.tsx) drawn with sample weeks, so its chart
// can be seen and checked live without a sign-in (devkit live/areas.json, area 10). No loader reads D1, and
// the goal editor is left out: it writes, and a demo writes nothing.
import { DemoNotice } from "~/components/demo-notice";
import { PageShell } from "~/components/page-shell";
import { ReadingActivity } from "~/components/reading/reading-activity";
import { Container, PageHeader } from "~/components/ui";
import { sampleActivity } from "~/lib/demo/reading-sample";
import type { Route } from "./+types/goals";
import { noindexMeta } from "~/lib/seo";

export function meta() {
  return noindexMeta("Reading goals demo | Foxing");
}

export function loader() {
  return sampleActivity();
}

export default function GoalsDemo({ loaderData }: Route.ComponentProps) {
  return (
    <PageShell>
      <Container className="fx-goals-wrap">
        <PageHeader eyebrow="Reading" title="Reading goals" className="mb-0" />
        <DemoNotice />
        <ReadingActivity weeks={loaderData.weeks} streak={loaderData.streak} />
      </Container>
    </PageShell>
  );
}

// It hydrates, as /goals does (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
