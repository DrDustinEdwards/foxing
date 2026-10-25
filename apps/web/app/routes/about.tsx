import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { HELLO_EMAIL } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/about";

export const headers = staticPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return buildMeta({
    title: "About",
    description: "Foxing is a reading home for the classics, built by one person.",
    pathname: location.pathname,
  });
}

export default function About() {
  return (
    <PageShell>
      <Container className="measure-prose">
        <PageHeader title="About Foxing" />
        <p className="mt-6 fx-about-text">
          Foxing is a reader for the classics. The name comes from the brown spots that bloom on the
          pages of old books. The kind of book that's been carried, marked, and remembered.
        </p>
        <p className="mt-4 fx-about-text">
          The catalog is public-domain literature, browsable and searchable, free to read. Track
          what you're reading, mark what you've finished, and follow the picks worth reading: award
          winners, celebrity picks, and Foxing's own monthly pick.
        </p>
        <p className="mt-4 fx-about-text">
          Built by Dustin Edwards. One person, one inbox. Email{" "}
          <a href={`mailto:${HELLO_EMAIL}`} className="link">
            {HELLO_EMAIL}
          </a>{" "}
          with anything.
        </p>
      </Container>
    </PageShell>
  );
}
