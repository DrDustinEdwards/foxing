// The operator API's tools: Capsid Admin's door into Foxing (/api/operator). backup_status and run_job are site-runtime's operatorJobTools.
import { operatorJobTools, type CronJob } from "@dustinedwards/site-runtime/cron";
import type { OperatorTool } from "@dustinedwards/site-runtime/operator";
import { backupStatus } from "./backup.server";

export function operatorTools(env: Env, jobs: () => CronJob[]): Record<string, OperatorTool> {
  return operatorJobTools({
    db: env.DB,
    jobs,
    backupStatus: () => backupStatus(env),
    files: ["journal", "journal-revisions", "covers"],
  });
}
