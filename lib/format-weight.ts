export type WeightUnit = "lbs" | "kg"

function parseWeightLbs(weight: unknown): number {
  if (weight == null || weight === "") return 0
  if (typeof weight === "number") return Number.isFinite(weight) ? weight : 0
  const n = Number(String(weight).replace(/[^0-9.]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function parseWeightKg(weightKg: unknown): number {
  if (weightKg == null || weightKg === "") return 0
  const n = Number(weightKg)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Format load weight using company preference (defaults to lbs). */
export function formatLoadWeight(
  load: { weight?: unknown; weight_kg?: unknown },
  unit: WeightUnit = "lbs",
): string {
  const lbs = parseWeightLbs(load.weight)
  const kg = parseWeightKg(load.weight_kg) || (lbs > 0 ? lbs * 0.453592 : 0)

  if (unit === "kg") {
    if (kg > 0) return `${Math.round(kg).toLocaleString()} kg`
    return "N/A"
  }

  if (lbs > 0) return `${Math.round(lbs).toLocaleString()} lbs`
  if (kg > 0) return `${Math.round(kg / 0.453592).toLocaleString()} lbs`
  return "N/A"
}
