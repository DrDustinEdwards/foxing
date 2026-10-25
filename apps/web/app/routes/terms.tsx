// Terms of service. Static content, edge-cached. Audited against the current
// build: reading now happens on the web as well as in the app (no app-only
// claim), and paid plans / AI output are scoped to when those features are
// available. Catalog sourcing and governing law carry over unchanged.
import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { LEGAL_EMAIL } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/terms";

const LAST_UPDATED = "10 July 2026";

export const headers = staticPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return buildMeta({
    title: "Terms of service",
    description: "The agreement for using Foxing: your account, your content, and the catalog.",
    pathname: location.pathname,
  });
}

export default function Terms() {
  return (
    <PageShell>
      <Container className="measure-prose">
        <PageHeader eyebrow={`Last updated ${LAST_UPDATED}`} title="Terms of service" />

        <div className="fx-terms-box">
          <Section heading="The short version">
            Read the books, save passages, talk about them with other readers. Do not abuse the
            community or other people. Keep your account credentials private. That covers most of
            it.
          </Section>

          <Section heading="Who can use Foxing">
            You must be at least 13 years old. If the law where you live sets a higher minimum age
            for consenting to data processing, you must meet that age instead.
          </Section>

          <Section heading="Your account">
            You are responsible for what happens under your account. One human per account. We can
            suspend accounts that break these terms.
          </Section>

          <Section heading="Content you post">
            You keep ownership of what you write. By posting in a public space you give Foxing a
            license to display it on the platform. If you delete it, we stop showing it.
          </Section>

          <Section heading="Catalog content">
            Books in the catalog are public-domain editions, primarily from Standard Ebooks and
            Project Gutenberg, and you can read them on the web and in the app. Where copyright
            applies, we honor it.
          </Section>

          <Section heading="AI output">
            When AI summaries or analysis are available, they are provided as-is and can be wrong.
            Do not treat them as the last word on a book.
          </Section>

          <Section heading="Paid plans">
            Foxing is free today. When paid plans are offered, they renew automatically until
            canceled, you can cancel any time from settings, and refunds are at our discretion
            within seven days of a charge.
          </Section>

          <Section heading="Termination">
            You can delete your account whenever you like. We can terminate accounts that abuse the
            service or violate the law.
          </Section>

          <Section heading="No warranty">
            The service is provided as-is. We aim for uptime but cannot guarantee it.
          </Section>

          <Section heading="Governing law">Texas, USA.</Section>

          <Section heading="Contact">
            <a href={`mailto:${LEGAL_EMAIL}`} className="link">
              {LEGAL_EMAIL}
            </a>
          </Section>
        </div>
      </Container>
    </PageShell>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display-1">{heading}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
