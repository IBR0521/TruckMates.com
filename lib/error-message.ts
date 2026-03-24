/**
 * Safe message extraction for `catch (error: unknown)` blocks.
 * Prefer this over `(error as Error).message`.
 */
export function errorMessage(error: unknown, fallback = "An unexpected error occurred"): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }
  return fallback
}
