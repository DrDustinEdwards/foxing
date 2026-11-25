// /demos/goals: sample weeks so the goals chart can be checked live without a sign-in; no loader reads D1 and the goal editor is left out.
import { DemoNotice } from "~/components/demo-notice";
import { PageShell } from "~/components/page-shell";
import { ReadingActivity } from "~/components/reading/reading-activity";
import { Container, PageHeader } from "~/components/ui";
import { sampleActivity } from "~/lib/demo/reading-sample";
import type { Route } from "./+types/goals";
import { noindexPageMeta } from "~/lib/seo";

export function meta() {
  return noindexPageMeta("Reading goals demo | Foxing");
}

export function loader() {
  return sampleActivity();
}

export default function GoalsDemo({ loaderData }: Route.ComponentProps) {
  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <PageHeader title="Reading goals" />
        <DemoNotice />
        <ReadingActivity weeks={loaderData.weeks} streak={loaderData.streak} />
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };
