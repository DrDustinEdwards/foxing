// Parses apps/web-cf/.dev.vars (KEY="value" format) into a plain object.
// Values are never logged or returned to callers as strings in error output.
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadDevVars(filePath?: string): Record<string, string> {
  const p = filePath ?? resolve(process.cwd(), 'apps/web-cf/.dev.vars')
  if (!existsSync(p)) return {}
  const lines = readFileSync(p, 'utf-8').split('\n')
  const vars: Record<string, string> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key) vars[key] = val
  }
  return vars
}

export function requireVar(vars: Record<string, string>, key: string): string {
  const val = vars[key] ?? process.env[key] ?? ''
  if (!val) {
    console.error(`[import-catalog] Missing required variable: ${key}`)
    console.error(`  Add ${key}="" to apps/web-cf/.dev.vars and re-run.`)
    process.exit(1)
  }
  return val
}
