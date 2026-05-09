/**
 * Direct Postgres client using SUPABASE_POOLER_URL.
 * Use only for heavy bulk operations. For all other database
 * operations, use the Supabase JS client which respects RLS.
 * IMPORTANT: This client bypasses RLS. Always scope queries
 * by company_id explicitly.
 */

import { Pool } from "pg"

let pool: Pool | null = null

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = process.env.SUPABASE_POOLER_URL
    if (!connectionString) {
      throw new Error("SUPABASE_POOLER_URL is not configured.")
    }
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

export async function queryPg<T = any>(
  text: string,
  params?: any[],
): Promise<{ rows: T[]; error: string | null }> {
  try {
    const p = getPgPool()
    const result = await p.query(text, params)
    return { rows: result.rows as T[], error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed"
    console.error("[pooler-pg]", message)
    return { rows: [], error: message }
  }
}
