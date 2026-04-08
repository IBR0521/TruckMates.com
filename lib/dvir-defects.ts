/** Summarize JSONB defect rows for list/detail UI (severity counts + highest). */

export type DefectSeveritySummary = {
  total: number
  critical: number
  major: number
  minor: number
  other: number
  highest: "critical" | "major" | "minor" | "other"
}

export function summarizeDefectSeverities(defects: unknown): DefectSeveritySummary | null {
  if (!Array.isArray(defects) || defects.length === 0) return null

  let critical = 0
  let major = 0
  let minor = 0
  let other = 0

  for (const row of defects) {
    const s = String((row as { severity?: string })?.severity || "")
      .toLowerCase()
      .trim()
    if (s === "critical") critical++
    else if (s === "major") major++
    else if (s === "minor") minor++
    else other++
  }

  const total = defects.length
  let highest: DefectSeveritySummary["highest"] = "other"
  if (critical > 0) {
    highest = "critical"
  } else if (major > 0) {
    highest = "major"
  } else if (minor > 0) {
    highest = "minor"
  }

  return { total, critical, major, minor, other, highest }
}

export function defectSeverityLabel(summary: DefectSeveritySummary): string {
  const parts: string[] = []
  if (summary.critical > 0) parts.push(`${summary.critical} critical`)
  if (summary.major > 0) parts.push(`${summary.major} major`)
  if (summary.minor > 0) parts.push(`${summary.minor} minor`)
  if (summary.other > 0) parts.push(`${summary.other} other`)
  return parts.length > 0 ? parts.join(", ") : `${summary.total} defect(s)`
}
