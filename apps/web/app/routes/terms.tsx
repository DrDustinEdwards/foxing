// Terms of service. Static content, edge-cached. Audited against the current
// build: reading now happens on the web as well as in the app (no app-only
// claim), and paid plans / AI output are scoped to when those features are
// available (Phase 4). Catalog sourcing and governing law carry over unchanged.
import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/terms";

const LAST_UPDATED = "10 July 2026";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { origin } = loaderBase(context, request);
  return { origin };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(3600, 604800);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Terms of service | Foxing" }];
  return buildMeta({
    title: "Terms of service",
    description: "The agreement for using Foxing: your account, your content, and the catalog.",
    origin: data.origin,
    pathname: location.pathname,
  });
}

export default function Terms() {
  return (
    <PageShell>
      <Container className="max-w-prose">
        <PageHeader eyebrow={`Last updated ${LAST_UPDATED}`} title="Terms of service" />

        <div className="space-y-8 font-ui text-base leading-relaxed text-secondary">
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
            <a href="mailto:legal@foxing.app" className="text-brand-text hover:underline">
              legal@foxing.app
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
      <h2 className="font-display text-xl text-primary">{heading}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
