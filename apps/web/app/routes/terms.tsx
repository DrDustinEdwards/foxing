// Terms of service. Static content, edge-cached. Audited against the current
// build: reading now happens on the web as well as in the app (no app-only
// claim), and paid plans / AI output are scoped to when those features are
// available. Catalog sourcing and governing law carry over unchanged.
import { PageShell } from "~/components/page-shell";
import { LegalDoc, type LegalSection } from "capsomer/react/legal-doc";
import { Container } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { LEGAL_EMAIL } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/terms";

const UPDATED = "2026-07-10";

const SECTIONS: LegalSection[] = [
  {
    id: "the-short-version",
    title: "The short version",
    body: (
      <p>
        Read the books, save passages, talk about them with other readers. Do not abuse the
        community or other people. Keep your account credentials private. That covers most of it.
      </p>
    ),
  },
  {
    id: "who-can-use-foxing",
    title: "Who can use Foxing",
    body: (
      <p>
        You must be at least 13 years old. If the law where you live sets a higher minimum age for
        consenting to data processing, you must meet that age instead.
      </p>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    body: (
      <p>
        You are responsible for what happens under your account. One human per account. We can
        suspend accounts that break these terms.
      </p>
    ),
  },
  {
    id: "content-you-post",
    title: "Content you post",
    body: (
      <p>
        You keep ownership of what you write. By posting in a public space you give Foxing a license
        to display it on the platform. If you delete it, we stop showing it.
      </p>
    ),
  },
  {
    id: "catalog-content",
    title: "Catalog content",
    body: (
      <p>
        Books in the catalog are public-domain editions, primarily from Standard Ebooks and Project
        Gutenberg, and you can read them on the web and in the app. Where copyright applies, we
        honor it.
      </p>
    ),
  },
  {
    id: "ai-output",
    title: "AI output",
    body: (
      <p>
        When AI summaries or analysis are available, they are provided as-is and can be wrong. Do
        not treat them as the last word on a book.
      </p>
    ),
  },
  {
    id: "paid-plans",
    title: "Paid plans",
    body: (
      <p>
        Foxing is free today. When paid plans are offered, they renew automatically until canceled,
        you can cancel any time from settings, and refunds are at our discretion within seven days
        of a charge.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    body: (
      <p>
        You can delete your account whenever you like. We can terminate accounts that abuse the
        service or violate the law.
      </p>
    ),
  },
  {
    id: "no-warranty",
    title: "No warranty",
    body: <p>The service is provided as-is. We aim for uptime but cannot guarantee it.</p>,
  },
  { id: "governing-law", title: "Governing law", body: <p>Texas, USA.</p> },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        <a href={`mailto:${LEGAL_EMAIL}`} className="link">
          {LEGAL_EMAIL}
        </a>
      </p>
    ),
  },
];

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
        <LegalDoc title="Terms of service" updated={UPDATED} sections={SECTIONS} />
      </Container>
    </PageShell>
  );
}
