import { ErrorPage } from "capsomer/react/error-page";
import { PageShell } from "./page-shell";

export function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <PageShell>
      <ErrorPage error={error} home="/" as="div" dev={import.meta.env.DEV} />
    </PageShell>
  );
}
