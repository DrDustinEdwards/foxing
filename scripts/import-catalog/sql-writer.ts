// Generates chunked INSERT OR REPLACE SQL files for wrangler d1 execute.

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SqlVal } from './types.ts'

function sqlVal(v: SqlVal): string {
  if (v === null) return 'NULL'
  if (typeof v === 'number') return String(v)
  return "'" + (v as string).replace(/'/g, "''") + "'"
}

export function writeChunked(
  table: string,
  rows: Record<string, SqlVal>[],
  outDir: string,
  prefix: string,
  chunkSize = 200,
): string[] {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows, skipping`)
    return []
  }

  mkdirSync(outDir, { recursive: true })
  const columns = Object.keys(rows[0]!)
  const colList = columns.join(', ')
  const written: string[] = []

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const n = Math.floor(i / chunkSize) + 1
    const filename = `${prefix}-${String(n).padStart(3, '0')}.sql`
    const filePath = resolve(outDir, filename)

    const valueLines = chunk.map(row =>
      '(' + columns.map(c => sqlVal(row[c] as SqlVal)).join(', ') + ')'
    )

    const sql = [
      `INSERT OR REPLACE INTO ${table} (${colList}) VALUES`,
      valueLines.join(',\n') + ';',
    ].join('\n')

    writeFileSync(filePath, sql, 'utf-8')
    written.push(filePath)
  }

  console.log(`  ${table}: ${rows.length} rows -> ${written.length} file(s)`)
  return written
}
