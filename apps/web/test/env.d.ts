/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { D1Migration } from "@cloudflare/vitest-pool-workers";

// The cloudflare:test `env` is typed as Cloudflare.Env; add the test-only migrations
// binding there so applyD1Migrations sees it.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
