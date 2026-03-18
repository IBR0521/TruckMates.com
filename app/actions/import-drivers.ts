"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { parseCsv, requireColumns, mapRow } from "@/lib/import/csv"

export type ImportError = { rowNumber: number; message: string }

export type ImportResult<T> = {
  inserted: number
  skipped: number
  errors: ImportError[]
  sample: T[]
}

interface DriverCsvRow {
  name: string
  email?: string | null
  phone?: string | null
  license_number?: string | null
  status?: string | null
}

export async function importDriversFromCsv(csv: string): Promise<ImportResult<DriverCsvRow>> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return {
      inserted: 0,
      skipped: 0,
      errors: [{ rowNumber: 0, message: ctx.error || "Not authenticated" }],
      sample: [],
    }
  }

  const { rows } = parseCsv(csv)
  if (!rows.length) {
    return {
      inserted: 0,
      skipped: 0,
      errors: [{ rowNumber: 0, message: "CSV is empty" }],
      sample: [],
    }
  }

  const required = ["name"]
  const { ok, missing } = requireColumns(rows, required)
  if (!ok) {
    return {
      inserted: 0,
      skipped: 0,
      errors: [
        {
          rowNumber: 0,
          message: `Missing required columns: ${missing.join(", ")}`,
        },
      ],
      sample: [],
    }
  }

  const sample: DriverCsvRow[] = []
  const errors: ImportError[] = []
  const validRows: DriverCsvRow[] = []

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2

    const name = row["name"]?.trim()
    if (!name) {
      errors.push({ rowNumber, message: "Missing name" })
      return
    }

    const driver = mapRow<DriverCsvRow>(row, {
      name: "name",
      email: "email",
      phone: "phone",
      license_number: "license_number",
      status: "status",
    })

    if (!driver.status) driver.status = "active"

    if (sample.length < 20) sample.push(driver)
    validRows.push(driver)
  })

  const supabase = await createClient()
  let inserted = 0
  let skipped = errors.length

  if (validRows.length > 0) {
    const payload = validRows.map((d) => ({
      company_id: ctx.companyId,
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      license_number: d.license_number || null,
      status: d.status || "active",
    }))

    const { error } = await supabase.from("drivers").insert(payload)

    if (error) {
      errors.push({ rowNumber: 0, message: error.message })
      skipped += validRows.length
    } else {
      inserted = validRows.length
    }
  }

  return { inserted, skipped, errors, sample }
}

