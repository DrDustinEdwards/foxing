import { errorTitle } from "capsomer/react/error-page";
import { SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/not-found";

export { ErrorBoundary } from "~/components/route-error";

// Its own route so the error page's header and footer load only here, not with the root; the root loader is skipped for an unmatched address, so the header is the signed-out one.
export function loader(): never {
  throw new Response("Not found", { status: 404 });
}

export function meta({ error }: Route.MetaArgs) {
  return error ? [{ title: errorTitle(error, SITE_NAME) }] : [];
}

export default () => null;
