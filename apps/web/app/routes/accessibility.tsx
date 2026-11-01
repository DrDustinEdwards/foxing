// The accessibility statement every site in the network carries, from Prelum's accessibilityStatement: the WCAG 2.2 AA
// aim, what is not yet tested and how to report a problem. Foxing is built from Capsomer and its running-text links are
// semibold as well as colored (base.css `.link`), so the statement says so.
import {
  ACCESSIBILITY_PATH,
  accessibilityStatement,
} from "@drdustinedwards/site-helpers/accessibility";
import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { HELLO_EMAIL } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";

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
        <PageHeader eyebrow="Last reviewed 1 November 2026" title={statement.title} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Prelum's fixed statement markup; no reader text reaches it */}
        <div className="fx-statement" dangerouslySetInnerHTML={{ __html: statement.html }} />
      </Container>
    </PageShell>
  );
}
