// Postgres connection pool for the import pipeline.
// Reads SUPABASE_DB_URL from apps/web/.dev.vars.
import { Pool } from 'pg'
import { loadDevVars, requireVar } from './devvars.ts'

export function createPool(): Pool {
  const vars = loadDevVars()
  const url = requireVar(vars, 'SUPABASE_DB_URL')
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
  })
}
