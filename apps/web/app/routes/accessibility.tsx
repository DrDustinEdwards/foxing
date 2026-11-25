import {
  ACCESSIBILITY_PATH,
  accessibilityStatement,
} from "@drdustinedwards/site-helpers/accessibility";
import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { HELLO_EMAIL } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";
import { markup } from "capsomer/behavior/trusted-html";

const REVIEWED = "2026-11-01";

const statement = accessibilityStatement({
  siteName: "Foxing",
  contact: { href: `mailto:${HELLO_EMAIL}`, label: HELLO_EMAIL },
  date: REVIEWED,
  capsomer: true,
  links: "bold",
});

export const headers = staticPageHeaders;

export function meta() {
  return buildMeta({
    title: statement.title,
    description: statement.description,
    pathname: ACCESSIBILITY_PATH,
  });
}

export default function Accessibility() {
  return (
    <PageShell>
      <Container className="measure-prose">
        <PageHeader title={statement.title} lede="Last reviewed 1 November 2026" />
        {/* Raw HTML: Prelum's fixed statement markup; no reader text reaches it. */}
        <div className="fx-statement" dangerouslySetInnerHTML={markup(statement.html)} />
      </Container>
    </PageShell>
  );
}
