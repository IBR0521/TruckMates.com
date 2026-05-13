import type { AiToolJsonSchema } from "@/lib/ai/tools/types"

function typeMatches(value: unknown, propSchema: unknown): boolean {
  if (!propSchema || typeof propSchema !== "object") return true
  const t = (propSchema as { type?: unknown }).type
  if (t === "string") return typeof value === "string"
  if (t === "number") return typeof value === "number" && Number.isFinite(value)
  if (t === "integer") return typeof value === "number" && Number.isInteger(value)
  if (t === "boolean") return typeof value === "boolean"
  if (t === "array") return Array.isArray(value)
  if (t === "object") return typeof value === "object" && value !== null && !Array.isArray(value)
  return true
}

export function validateToolInputSchema(
  input: unknown,
  schema: AiToolJsonSchema,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Tool input must be a JSON object." }
  }
  const obj = input as Record<string, unknown>
  const required = schema.required || []
  for (const key of required) {
    if (!(key in obj) || obj[key] === undefined || obj[key] === null || obj[key] === "") {
      return { ok: false, error: `Missing required field: ${key}` }
    }
  }
  const props = schema.properties || {}
  for (const [key, val] of Object.entries(obj)) {
    const propSchema = props[key]
    if (propSchema !== undefined && !typeMatches(val, propSchema)) {
      return { ok: false, error: `Invalid type for field: ${key}` }
    }
  }
  return { ok: true, value: obj }
}
