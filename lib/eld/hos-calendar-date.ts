/**
 * Calendar YYYY-MM-DD in the **runtime local timezone** (Node: `TZ` / host; browser: user).
 * Use this for `eld_logs.log_date` and HOS queries so they match `changeDriverDutyStatus` inserts.
 * Avoid `toISOString().slice(0, 10)` alone — that is **UTC** date and can disagree by one day.
 */
export function calendarDateYmdLocal(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
