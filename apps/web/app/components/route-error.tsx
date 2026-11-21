import { ErrorPage } from "capsomer/react/error-page";
import { PageShell } from "./page-shell";

// A route's error page (its own meta supplies the title) in the site's header and footer: the same for an unknown address (routes/not-found.tsx) and for
// a page whose loader throws a 404 (a missing book, author or post). The root's own boundary is bare, for errors in
// the root itself.
export function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <PageShell>
      <ErrorPage error={error} home="/" as="div" dev={import.meta.env.DEV} />
    </PageShell>
  );
}
