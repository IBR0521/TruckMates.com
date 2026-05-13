export type AiPriority = "critical" | "high" | "medium" | "low"

export function aiPriorityRank(p: string | null | undefined): number {
  switch (p) {
    case "critical":
      return 4
    case "high":
      return 3
    case "medium":
      return 2
    case "low":
      return 1
    default:
      return 0
  }
}

export function legacyPriorityToAi(p: string | null | undefined): AiPriority | null {
  if (p === "critical" || p === "high" || p === "medium" || p === "low") return p
  if (p === "normal") return "medium"
  return null
}

/** Prefer AI column when present; otherwise map legacy `priority` into AI bands. */
export function effectiveAiPriority(
  ai: string | null | undefined,
  legacy: string | null | undefined,
): AiPriority {
  if (ai === "critical" || ai === "high" || ai === "medium" || ai === "low") return ai
  const mapped = legacyPriorityToAi(legacy)
  return mapped ?? "medium"
}
