export type PermitRequirementInput = {
  weight_kg?: unknown
  weight?: unknown
  length?: unknown
  width?: unknown
  height?: unknown
  is_oversized?: unknown
}

export type PermitRequirementResult = {
  required: boolean
  reason: string | null
}

/** Oversize/overweight thresholds used before dispatch (matches FMCSO-style defaults). */
export function computePermitRequirement(input: PermitRequirementInput): PermitRequirementResult {
  const weightKg = Number(input.weight_kg || 0)
  const parsedWeightLbs = Number(String(input.weight || "").replace(/[^0-9.]/g, ""))
  const weightLbs = weightKg > 0 ? weightKg * 2.20462 : 0
  const effectiveWeightLbs = weightLbs > 0 ? weightLbs : parsedWeightLbs
  const lengthFt = Number(input.length || 0)
  const widthFt = Number(input.width || 0)
  const heightFt = Number(input.height || 0)
  const oversized = Boolean(input.is_oversized)

  const reasons: string[] = []
  if (effectiveWeightLbs > 80000) reasons.push(`weight ${effectiveWeightLbs.toFixed(0)} lbs > 80,000 lbs`)
  if (lengthFt > 53) reasons.push(`length ${lengthFt} ft > 53 ft`)
  if (widthFt > 8.5) reasons.push(`width ${widthFt} ft > 8.5 ft`)
  if (heightFt > 13.5) reasons.push(`height ${heightFt} ft > 13.5 ft`)
  if (oversized) reasons.push("load is marked oversized")

  if (reasons.length === 0) return { required: false, reason: null }
  return { required: true, reason: reasons.join("; ") }
}

export type PermitRow = {
  expiry_date: string | null
  document_id: string | null
}

export function hasValidPermitAttachment(
  permits: PermitRow[] | null | undefined,
  todayIsoDate: string,
): boolean {
  return (permits || []).some((permit) => {
    const notExpired = !permit.expiry_date || permit.expiry_date >= todayIsoDate
    return Boolean(permit.document_id) && notExpired
  })
}
