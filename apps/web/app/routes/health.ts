import { healthResponse } from "@dustinedwards/site-runtime/health";
import { cloudflareContext } from "~/context";
import { backupStatus } from "~/lib/backup.server";
import type { Route } from "./+types/health";

// GET /health for uptime monitors and the Capsid console: site-runtime's response, D1 pinged with SELECT 1.
export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return healthResponse({
    ping: () => env.DB.prepare("SELECT 1").first(),
    backup: () => backupStatus(env),
  });
}
