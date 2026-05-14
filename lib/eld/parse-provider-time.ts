/** Parse provider timestamps (ISO strings, epoch ms, seconds) to epoch ms. */
export function parseTimestampMs(input: unknown): number | null {
  if (input == null) return null
  if (typeof input === "number" && Number.isFinite(input)) {
    if (input > 1e12) return Math.floor(input)
    if (input > 1e9) return Math.floor(input * 1000)
    return null
  }
  if (typeof input === "string") {
    const t = Date.parse(input)
    return Number.isFinite(t) ? t : null
  }
  return null
}
