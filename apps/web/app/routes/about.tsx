import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/about";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { origin } = loaderBase(context, request);
  return { origin };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(3600, 604800);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  return buildMeta({
    title: "About",
    description: "Foxing is a reading home for the classics, built by one person.",
    origin: data?.origin ?? "",
    pathname: location.pathname,
  });
}

export default function About() {
  return (
    <PageShell>
      <Container className="max-w-prose">
        <PageHeader title="About Foxing" />
        <p className="mt-6 font-body text-base text-secondary">
          Foxing is a reader for the classics. The name comes from the brown spots that bloom on the
          pages of old books. The kind of book that's been carried, marked, and remembered.
        </p>
        <p className="mt-4 font-body text-base text-secondary">
          The catalog is public-domain literature, browsable and searchable, free to read. Track
          what you're reading, mark what you've finished, and follow the picks worth reading: award
          winners, celebrity picks, and Foxing's own monthly pick.
        </p>
        <p className="mt-4 font-body text-base text-secondary">
          Built by Dustin Edwards. One person, one inbox. Email{" "}
          <a href="mailto:hello@foxing.app" className="text-brand-text hover:underline">
            hello@foxing.app
          </a>{" "}
          with anything.
        </p>
      </Container>
    </PageShell>
  );
}
