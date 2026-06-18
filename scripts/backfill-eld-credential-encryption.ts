#!/usr/bin/env tsx
/**
 * One-time backfill: encrypt plaintext eld_devices.api_key / api_secret values.
 *
 *   ELD_CREDENTIALS_ENCRYPTION_KEY=<base64-32-bytes> npm run backfill:eld-credentials
 *
 * Idempotent — skips values already in eld1:... encrypted format.
 */

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Pool } from "pg"
import {
  encryptCredentialIfNeeded,
} from "../lib/crypto/eld-credentials"
import { eldDeviceNeedsCredentialEncryption } from "../lib/eld/device-credentials"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BATCH_SIZE = 50

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const raw = readFileSync(filePath, "utf8")
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvFile(path.join(ROOT, ".env.local"))
loadEnvFile(path.join(ROOT, ".env"))

type Row = {
  id: string
  company_id: string
  api_key: string | null
  api_secret: string | null
}

async function main() {
  const connectionString = process.env.SUPABASE_POOLER_URL
  if (!connectionString) {
    console.error("SUPABASE_POOLER_URL is required")
    process.exit(1)
  }
  if (!process.env.ELD_CREDENTIALS_ENCRYPTION_KEY) {
    console.error("ELD_CREDENTIALS_ENCRYPTION_KEY is required")
    process.exit(1)
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  })

  try {
    const { rows } = await pool.query<Row>(
      `SELECT id, company_id, api_key, api_secret
       FROM public.eld_devices
       WHERE api_key IS NOT NULL OR api_secret IS NOT NULL
       ORDER BY id`,
    )

    const needing = rows.filter(eldDeviceNeedsCredentialEncryption)
    console.log(`Found ${rows.length} device(s) with credential columns; ${needing.length} need encryption`)

    if (needing.length === 0) {
      console.log("Nothing to backfill.")
      return
    }

    let updated = 0
    for (let i = 0; i < needing.length; i += BATCH_SIZE) {
      const batch = needing.slice(i, i + BATCH_SIZE)
      for (const row of batch) {
        const nextKey =
          row.api_key != null && row.api_key !== ""
            ? encryptCredentialIfNeeded(String(row.api_key))
            : row.api_key
        const nextSecret =
          row.api_secret != null && row.api_secret !== ""
            ? encryptCredentialIfNeeded(String(row.api_secret))
            : row.api_secret

        const keyChanged = row.api_key !== nextKey
        const secretChanged = row.api_secret !== nextSecret
        if (!keyChanged && !secretChanged) continue

        await pool.query(
          `UPDATE public.eld_devices
           SET api_key = $2, api_secret = $3, updated_at = now()
           WHERE id = $1`,
          [row.id, nextKey, nextSecret],
        )
        updated += 1
      }
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, needing.length)}/${needing.length} checked, ${updated} updated`)
    }

    const { rows: verify } = await pool.query<{ remaining: string }>(
      `SELECT COUNT(*)::text AS remaining
       FROM public.eld_devices
       WHERE (api_key IS NOT NULL AND api_key <> '' AND api_key NOT LIKE 'eld1:%')
          OR (api_secret IS NOT NULL AND api_secret <> '' AND api_secret NOT LIKE 'eld1:%')`,
    )
    const remaining = Number(verify[0]?.remaining ?? 0)
    console.log(`Backfill complete. Updated ${updated} row(s). Remaining plaintext credential columns: ${remaining}`)
    if (remaining > 0) {
      process.exit(1)
    }
  } finally {
    await pool.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
