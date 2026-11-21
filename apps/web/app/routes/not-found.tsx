import { errorTitle } from "capsomer/react/error-page";
import { SITE_NAME } from "~/lib/seo";
import type { Route } from "./+types/not-found";

export { ErrorBoundary } from "~/components/route-error";

// Every address no route matches. Its own route, so the header and footer the error page wears load only here and
// not with the root, which every page that hydrates carries. The root loader is skipped for an unmatched address,
// so the header is the signed-out one.
export function loader(): never {
  throw new Response("Not found", { status: 404 });
}

export function meta({ error }: Route.MetaArgs) {
  return error ? [{ title: errorTitle(error, SITE_NAME) }] : [];
}

export default () => null;
