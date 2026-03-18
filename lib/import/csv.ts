export type CsvRow = Record<string, string>

export function parseCsv(csv: string): { rows: CsvRow[]; headers: string[] } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { rows: [], headers: [] }
  }

  const headerCells = lines[0].split(",")
  const headers = headerCells.map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  )

  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",")
    const row: CsvRow = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim()
    })
    rows.push(row)
  }

  return { rows, headers }
}

export function requireColumns(
  rows: CsvRow[],
  required: string[],
): { ok: boolean; missing: string[] } {
  if (!rows.length) return { ok: false, missing: required }
  const headers = Object.keys(rows[0])
  const missing = required.filter((c) => !headers.includes(c))
  return { ok: missing.length === 0, missing }
}

export function mapRow<T>(
  row: CsvRow,
  mapping: Record<Extract<keyof T, string>, string>,
): T {
  const out: any = {}
  for (const [key, header] of Object.entries(mapping) as Array<[Extract<keyof T, string>, string]>) {
    out[key] = row[header] ?? null
  }
  return out as T
}

