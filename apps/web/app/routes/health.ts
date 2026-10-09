import { cloudflareContext } from "~/context";
import { healthResponse } from "~/lib/health.server";
import type { Route } from "./+types/health";

// Resource route: the response is built in lib/health.server.ts, where the tests reach it.
export function loader({ context }: Route.LoaderArgs) {
  return healthResponse(context.get(cloudflareContext).env);
}
