import { redirectResponse } from "@dustinedwards/site-runtime/http";
import { redirectStatus } from "@dustinedwards/site-runtime/url";
import type { Route } from "./+types/book-legacy";

export function loader({ request, params }: Route.LoaderArgs) {
  const to = new URL(request.url);
  to.pathname = `/books/${encodeURIComponent(params.slug)}`;
  throw redirectResponse(to, redirectStatus(request.method));
}
